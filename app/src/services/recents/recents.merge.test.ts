import { describe, expect, it } from "vitest";
import { mergeRecentTouches, recentKindForEvent } from "./recents.merge";

describe("mergeRecentTouches", () => {
  it("keeps one entry per entity at its latest time, newest first", () => {
    const merged = mergeRecentTouches([
      { kind: "note", id: "a", at: new Date("2026-10-01") },
      { kind: "collection", id: "c", at: new Date("2026-10-03") },
      { kind: "note", id: "a", at: new Date("2026-10-05") },
      { kind: "tag", id: "a", at: new Date("2026-10-02") },
    ]);
    expect(merged.map((t) => `${t.kind}:${t.id}`)).toEqual([
      "note:a",
      "collection:c",
      "tag:a",
    ]);
    expect(merged[0].at.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
});

describe("recentKindForEvent", () => {
  it("maps visit and edit events to kinds and ignores the rest", () => {
    expect(recentKindForEvent("doc.update")).toBe("note");
    expect(recentKindForEvent("research.view")).toBe("research");
    expect(recentKindForEvent("search.query.executed")).toBeUndefined();
  });
});
