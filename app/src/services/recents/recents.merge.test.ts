import { describe, expect, it } from "vitest";
import { mergeRecentItems } from "./recents.merge";
import type { RecentItem } from "./recents.types";

const item = (kind: RecentItem["kind"], id: string, at: string): RecentItem => ({
  kind,
  id,
  title: id,
  href: `/${kind}/${id}`,
  at: new Date(at).toISOString(),
});

describe("mergeRecentItems", () => {
  it("keeps one entry per entity at its latest time, newest first", () => {
    const merged = mergeRecentItems(
      [
        item("note", "a", "2026-10-01"),
        item("collection", "c", "2026-10-03"),
        item("note", "a", "2026-10-05"),
        item("research", "a", "2026-10-02"),
      ],
      10,
    );
    expect(merged.map((t) => `${t.kind}:${t.id}`)).toEqual([
      "note:a",
      "collection:c",
      "research:a",
    ]);
    expect(merged[0].at).toBe("2026-10-05T00:00:00.000Z");
  });

  it("caps the list at take", () => {
    const merged = mergeRecentItems(
      [item("note", "a", "2026-10-01"), item("note", "b", "2026-10-02")],
      1,
    );
    expect(merged.map((t) => t.id)).toEqual(["b"]);
  });
});
