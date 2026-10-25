import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listTimelineEvents: vi.fn(),
  findMany: vi.fn(),
}));
vi.mock("~/server/activity/activity-store", () => ({
  listTimelineEvents: mocks.listTimelineEvents,
}));
vi.mock("~/server/db", () => ({
  prisma: { actionEvent: { findMany: mocks.findMany } },
}));
vi.mock("~/server/events/action-events", () => ({ logActionEvent: vi.fn() }));

const { registerActivityTools } = await import("./activity-tools");

type Handler = (args: Record<string, unknown>) => Promise<any>;
const handlers = new Map<string, Handler>();
registerActivityTools({
  ctx: {
    origin: "https://notes.test",
    actorId: "chatgpt:test",
    scopes: ["notes:read"],
    scopeChallenge: "",
  },
  read: (name: string, _spec: unknown, handler: Handler) =>
    handlers.set(name, handler),
  write: () => {},
} as never);
const query = (args: Record<string, unknown>) =>
  handlers.get("activity_query")!(args);

const event = (
  id: string,
  at: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  createdAt: at,
  eventType: "doc.create",
  actorType: "chatgpt",
  entityType: "doc",
  entityId: "n1",
  relatedDocId: "n1",
  relatedDocTitle: "Plan",
  requestId: null,
  payload: {},
  ...extra,
});

describe("activity_query", () => {
  it("gives a pollSince just past the newest event, and pages back when truncated", async () => {
    mocks.listTimelineEvents.mockResolvedValue([
      event("e2", "2026-10-23T18:30:00.000Z"),
      event("e1", "2026-10-23T18:00:00.000Z"),
    ]);
    const result = await query({ limit: 2 });
    expect(result).toMatchObject({
      truncated: true,
      nextCursor: "e1",
      pollSince: "2026-10-23T18:30:00.001Z",
    });
    expect(result.events.map((e: { id: string }) => e.id)).toEqual([
      "e2",
      "e1",
    ]);

    await query({
      since: "2026-10-23T17:00:00Z",
      cursor: "e1",
      until: "2026-10-23T19:00:00Z",
    });
    expect(mocks.listTimelineEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: "e1", to: "2026-10-23T19:00:00.000Z" }),
    );
  });

  it("reads a truncated poll forward, so its pollSince skips nothing", async () => {
    mocks.listTimelineEvents.mockReset();
    mocks.listTimelineEvents
      .mockResolvedValueOnce([
        event("e1", "2026-10-23T18:00:00.000Z"),
        event("e2", "2026-10-23T18:10:00.000Z"),
        event("e3", "2026-10-23T18:10:00.000Z"),
      ])
      .mockResolvedValueOnce([
        event("e2", "2026-10-23T18:10:00.000Z"),
        event("e3", "2026-10-23T18:10:00.000Z"),
      ]);
    const result = await query({ since: "2026-10-23T17:00:00Z", limit: 2 });
    expect(mocks.listTimelineEvents).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ take: 3, oldestFirst: true }),
    );
    // e2 and e3 share a timestamp, so both come back rather than splitting it.
    expect(result.events.map((e: { id: string }) => e.id)).toEqual([
      "e3",
      "e2",
      "e1",
    ]);
    expect(result).toMatchObject({
      truncated: true,
      nextCursor: null,
      pollSince: "2026-10-23T18:10:00.001Z",
    });
  });

  it("reports each MCP call's outcome, duration, and the records it changed", async () => {
    mocks.listTimelineEvents.mockResolvedValue([
      event("c1", "2026-10-23T18:00:00.000Z", {
        eventType: "mcp.call.ok",
        entityType: "mcp_tool",
        entityId: "notes_create",
        relatedDocId: null,
        requestId: "call-1",
        payload: { durationMs: 210, code: null, agent: "ChatGPT" },
      }),
    ]);
    mocks.findMany.mockResolvedValue([
      {
        requestId: "call-1",
        eventType: "doc.create",
        entityId: "n9",
        relatedDocId: "n9",
      },
    ]);
    const { events, truncated } = await query({ domain: "mcp" });
    expect(truncated).toBe(false);
    expect(events[0]).toMatchObject({
      callId: "call-1",
      tool: "notes_create",
      outcome: "ok",
      durationMs: 210,
      changed: [{ type: "doc.create", entityId: "n9", noteId: "n9" }],
    });
  });
});
