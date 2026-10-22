import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ actionEvent: { count: vi.fn() } }));
const events = vi.hoisted(() => ({ logActionEvent: vi.fn() }));
vi.mock("~/server/db", () => ({ prisma: db }));
vi.mock("~/server/events/action-events", () => events);

import { recordMcpCall, summarizeArgs } from "./call-log";

const ctx = {
  origin: "https://notes.test",
  actorId: "chatgpt:vn_1",
  scopes: ["notes:read", "notes:write"],
  scopeChallenge: "",
  clientName: "Claude",
};

describe("summarizeArgs", () => {
  it("trims long strings and arrays so note bodies stay out of the log", () => {
    const summary = summarizeArgs({
      markdown: "x".repeat(500),
      ids: ["a", "b", "c", "d", "e"],
      limit: 10,
      skipped: undefined,
    });
    expect(summary).toBe(
      `{"markdown":"${"x".repeat(60)}… (500 chars)","ids":["a","b","c","…2 more"],"limit":10}`,
    );
  });

  it("returns null for calls without arguments", () => {
    expect(summarizeArgs({})).toBeNull();
    expect(summarizeArgs(undefined)).toBeNull();
  });
});

describe("recordMcpCall", () => {
  beforeEach(() => vi.clearAllMocks());

  it("logs a write call with how many events it caused", async () => {
    db.actionEvent.count.mockResolvedValue(2);
    await recordMcpCall({
      ctx,
      callId: "call-1",
      tool: "notes_create",
      kind: "write",
      outcome: "ok",
      durationMs: 12,
      args: { title: "Trip" },
    });
    expect(db.actionEvent.count).toHaveBeenCalledWith({
      where: {
        requestId: "call-1",
        NOT: { eventType: { startsWith: "mcp.call." } },
      },
    });
    expect(events.logActionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "mcp.call.ok",
        entityType: "mcp_tool",
        entityId: "notes_create",
        context: {
          actorId: "chatgpt:vn_1",
          actorType: "chatgpt",
          requestId: "call-1",
        },
        payload: expect.objectContaining({
          agent: "Claude",
          changes: 2,
          args: '{"title":"Trip"}',
        }),
      }),
    );
  });

  it("skips the change count for reads and never throws", async () => {
    events.logActionEvent.mockRejectedValueOnce(new Error("db down"));
    await expect(
      recordMcpCall({
        ctx,
        callId: "call-2",
        tool: "search",
        kind: "read",
        outcome: "refused",
        code: "invalid",
        durationMs: 3,
        args: { query: "" },
      }),
    ).resolves.toBeUndefined();
    expect(db.actionEvent.count).not.toHaveBeenCalled();
  });
});
