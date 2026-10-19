import { describe, expect, it } from "vitest";
import {
  buildPathTree,
  filterPathTree,
  findPathNode,
  firstPathMatch,
  flattenVisiblePaths,
  typeaheadMatch,
} from "./path-tree";

const stats = [
  {
    path: "work.visual-notes.design",
    count: 3,
    lastUpdatedAt: "2026-10-10T00:00:00.000Z",
  },
  {
    path: "work.visual-notes",
    count: 1,
    lastUpdatedAt: "2026-10-12T00:00:00.000Z",
  },
  {
    path: "work.meetings",
    count: 2,
    lastUpdatedAt: "2026-09-01T00:00:00.000Z",
  },
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

describe("flattenVisiblePaths", () => {
  it("lists rows in tree order and skips collapsed children", () => {
    const root = buildPathTree(stats);
    const open = new Set(["work"]);
    const rows = flattenVisiblePaths(root, (path) => open.has(path));
    expect(rows.map((row) => row.path)).toEqual([
      "ideas",
      "work",
      "work.meetings",
      "work.visual-notes",
    ]);
    expect(rows[2].parentPath).toBe("work");
    expect(rows[3].hasChildren).toBe(true);
  });
});

describe("typeaheadMatch", () => {
  const root = buildPathTree(stats);
  const rows = flattenVisiblePaths(root, () => true);
  // ideas, work, work.meetings, work.visual-notes, work.visual-notes.design

  it("finds the next row starting with the prefix, wrapping around", () => {
    expect(typeaheadMatch(rows, 0, "w")).toBe(1);
    expect(typeaheadMatch(rows, 4, "i")).toBe(0);
  });

  it("keeps the current row for a growing multi-letter prefix", () => {
    expect(typeaheadMatch(rows, 3, "vi")).toBe(3);
    expect(typeaheadMatch(rows, 0, "des")).toBe(4);
  });

  it("cycles on a repeated letter and returns -1 without a match", () => {
    expect(typeaheadMatch(rows, 1, "ww")).toBe(1);
    expect(typeaheadMatch(rows, 0, "zz")).toBe(-1);
  });
});
