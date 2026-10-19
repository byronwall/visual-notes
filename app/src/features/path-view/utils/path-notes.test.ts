import { describe, expect, it } from "vitest";
import { filterPathNotes, groupPathNotes, relativeNotePath, sortPathNotes } from "./path-notes";

const notes = [
  { id: "a", title: "Beta", path: "work.design", updatedAt: "2026-10-01T00:00:00.000Z" },
  { id: "b", title: "alpha", path: "work", updatedAt: "2026-10-03T00:00:00.000Z" },
  { id: "c", title: "Gamma", path: "work.design.v2", updatedAt: "2026-10-02T00:00:00.000Z" },
];

describe("path notes", () => {
  it("computes paths relative to the page path", () => {
    expect(relativeNotePath("work.design.v2", "work")).toBe("design.v2");
    expect(relativeNotePath("work", "work")).toBe("");
  });

  it("sorts by recency or title", () => {
    expect(sortPathNotes(notes, "recent").map((n) => n.id)).toEqual(["b", "c", "a"]);
    expect(sortPathNotes(notes, "title").map((n) => n.id)).toEqual(["b", "a", "c"]);
  });

  it("filters on title and relative path", () => {
    expect(filterPathNotes(notes, "v2", "work").map((n) => n.id)).toEqual(["c"]);
    expect(filterPathNotes(notes, "ALPHA", "work").map((n) => n.id)).toEqual(["b"]);
  });

  it("groups by immediate child with notes filed here first", () => {
    const groups = groupPathNotes(notes, "work");
    expect(groups.map((g) => [g.groupPath, g.notes.map((n) => n.id)])).toEqual([
      ["", ["b"]],
      ["work.design", ["a", "c"]],
    ]);
  });
});
