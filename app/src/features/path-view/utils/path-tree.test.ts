import { describe, expect, it } from "vitest";
import { buildPathTree, filterPathTree, findPathNode, firstPathMatch } from "./path-tree";

const stats = [
  { path: "work.visual-notes.design", count: 3, lastUpdatedAt: "2026-10-10T00:00:00.000Z" },
  { path: "work.visual-notes", count: 1, lastUpdatedAt: "2026-10-12T00:00:00.000Z" },
  { path: "work.meetings", count: 2, lastUpdatedAt: "2026-09-01T00:00:00.000Z" },
  { path: "ideas", count: 4, lastUpdatedAt: null },
];

describe("buildPathTree", () => {
  it("rolls counts and recency up every ancestor", () => {
    const root = buildPathTree(stats);
    expect(root.totalCount).toBe(10);
    const work = findPathNode(root, "work");
    expect(work?.totalCount).toBe(6);
    expect(work?.ownCount).toBe(0);
    expect(work?.lastUpdatedAt).toBe("2026-10-12T00:00:00.000Z");
    const notes = findPathNode(root, "work.visual-notes");
    expect(notes?.ownCount).toBe(1);
    expect(notes?.totalCount).toBe(4);
    expect(root.children.map((child) => child.segment)).toEqual(["ideas", "work"]);
  });

  it("returns undefined for unknown paths", () => {
    expect(findPathNode(buildPathTree(stats), "work.nope")).toBeUndefined();
  });
});

describe("filterPathTree", () => {
  it("keeps matches and their ancestors only", () => {
    const filtered = filterPathTree(buildPathTree(stats), "design");
    expect(filtered?.children.map((child) => child.path)).toEqual(["work"]);
    expect(filtered?.children[0].children.map((child) => child.path)).toEqual([
      "work.visual-notes",
    ]);
  });
});

describe("firstPathMatch", () => {
  const root = buildPathTree(stats);
  it("returns the first segment match in tree order", () => {
    expect(firstPathMatch(root, "meet")).toBe("work.meetings");
    expect(firstPathMatch(root, "DESIGN")).toBe("work.visual-notes.design");
  });
  it("matches across a dot and returns null for no match", () => {
    expect(firstPathMatch(root, "notes.des")).toBe("work.visual-notes.design");
    expect(firstPathMatch(root, "zzz")).toBeNull();
    expect(firstPathMatch(root, " ")).toBeNull();
  });
});
