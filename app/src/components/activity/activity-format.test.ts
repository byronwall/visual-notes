import { describe, expect, it } from "vitest";
import type { ActionEventItem } from "~/services/activity/activity.types";
import {
  clockTimeFor,
  collapseRepeats,
  dayKeyFor,
  describeActivityEvent,
  groupByDay,
  relativeLabelFor,
} from "./activity-format";

const event = (overrides: Partial<ActionEventItem>): ActionEventItem => ({
  id: "e1",
  createdAt: "2026-10-17T15:00:00.000Z",
  eventType: "doc.view",
  actorType: "magic_user",
  entityType: "doc",
  ...overrides,
});

describe("describeActivityEvent", () => {
  it("describes an MCP write call with a link to what it changed", () => {
    const d = describeActivityEvent(
      event({
        eventType: "mcp.call.ok",
        actorType: "chatgpt",
        actorId: "chatgpt:vn_1",
        entityType: "mcp_tool",
        entityId: "notes_create",
        requestId: "call-1",
        payload: {
          tool: "notes_create",
          kind: "write",
          durationMs: 42,
          agent: "Claude",
          args: '{"title":"Trip"}',
          changes: 1,
        },
      }),
    );
    expect(d.domain).toBe("mcp");
    expect(d.verb).toBe("Called");
    expect(d.docTitle).toBe("notes_create");
    expect(d.docHref).toBe("/activity?type=mcp&tool=notes_create");
    expect(d.detail).toBe('{"title":"Trip"} · 1 change · 42ms');
    expect(d.href).toBe("/activity?call=call-1");
    expect(d.via).toBe("Claude");
  });

  it("shows a refused MCP call as a problem with its reason", () => {
    const d = describeActivityEvent(
      event({
        eventType: "mcp.call.refused",
        actorType: "chatgpt",
        entityType: "mcp_tool",
        entityId: "notes_update",
        payload: { code: "not_owner", message: "Not your note", durationMs: 5 },
      }),
    );
    expect(d.verb).toBe("Refused");
    expect(d.tone).toBe("danger");
    expect(d.detail).toBe("not_owner: Not your note · 5ms");
    expect(d.href).toBeNull();
  });

  it("describes a search with query and result count", () => {
    const d = describeActivityEvent(
      event({
        eventType: "search.query.executed",
        entityType: "search",
        payload: { queryPreview: "camping gear", resultCount: 1 },
      }),
    );
    expect(d.verb).toBe("Searched");
    expect(d.detail).toBe("“camping gear” · 1 result");
    expect(d.domain).toBe("search");
  });

  it("calls a title-only update a rename and links the note", () => {
    const d = describeActivityEvent(
      event({
        eventType: "doc.update",
        relatedDocId: "doc1",
        relatedDocTitle: "Trip",
        payload: { fieldsChanged: ["title"] },
      }),
    );
    expect(d).toMatchObject({
      verb: "Renamed",
      docTitle: "Trip",
      docHref: "/docs/doc1",
    });
  });

  it("flags failed prompt runs and links the run", () => {
    const d = describeActivityEvent(
      event({
        eventType: "ai.prompt.run_finished",
        entityType: "prompt_run",
        entityId: "run1",
        payload: { status: "ERROR", model: "gpt-4o-mini" },
      }),
    );
    expect(d).toMatchObject({
      verb: "Prompt run failed",
      tone: "danger",
      href: "/ai/runs/run1",
      detail: "gpt-4o-mini",
    });
  });

  it("summarizes migration counts", () => {
    const d = describeActivityEvent(
      event({
        eventType: "admin.inline_image_migration.finished",
        entityType: "admin_job",
        payload: { updatedDocs: 2, migratedImageRefs: 1, failures: 0 },
      }),
    );
    expect(d.detail).toBe("2 notes updated · 1 image moved");
  });

  it("falls back to a readable event type", () => {
    expect(
      describeActivityEvent(event({ eventType: "sync.job_ran" })).verb,
    ).toBe("Sync job ran");
  });
});

describe("collapseRepeats", () => {
  it("merges back-to-back views of the same note", () => {
    const rows = collapseRepeats([
      event({ id: "a", relatedDocId: "d" }),
      event({ id: "b", relatedDocId: "d" }),
      event({ id: "c", relatedDocId: "x" }),
    ]);
    expect(rows.map((r) => [r.event.id, r.count])).toEqual([
      ["a", 2],
      ["c", 1],
    ]);
  });
});

describe("day grouping", () => {
  it("groups by calendar day in the given zone", () => {
    const now = Date.parse("2026-10-17T18:00:00.000Z");
    const groups = groupByDay(
      [
        event({ id: "a", createdAt: "2026-10-17T16:00:00.000Z" }),
        event({ id: "b", createdAt: "2026-10-17T02:00:00.000Z" }),
        event({ id: "c", createdAt: "2026-10-14T12:00:00.000Z" }),
      ],
      "America/Chicago",
      now,
    );
    expect(groups.map((g) => [g.label, g.events.length])).toEqual([
      ["Today", 1],
      ["Yesterday", 1],
      ["Wed, Oct 14", 1],
    ]);
    expect(dayKeyFor("2026-10-17T02:00:00.000Z", "UTC")).toBe("2026-10-17");
    expect(clockTimeFor("2026-10-17T16:05:00.000Z", "UTC")).toBe("4:05 PM");
    expect(relativeLabelFor("2026-10-17T17:59:40.000Z", now)).toBe("just now");
    expect(relativeLabelFor("2026-10-17T17:48:00.000Z", now)).toBe("12m ago");
    expect(relativeLabelFor("2026-10-17T13:00:00.000Z", now)).toBe("5h ago");
  });
});
