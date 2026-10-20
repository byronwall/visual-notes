import { describe, expect, it } from "vitest";
import { buildPathTree, normalizeNotePath, pathExists } from "./paths";

describe("normalizeNotePath", () => {
  it("trims segments and drops empties, keeping case like the app does", () => {
    expect(normalizeNotePath(" Work.. Projects .alpha ")).toBe(
      "Work.Projects.alpha",
    );
    expect(normalizeNotePath("  ")).toBeNull();
    expect(normalizeNotePath(undefined)).toBeNull();
  });
});

describe("pathExists", () => {
  it("matches exact paths and ancestors but not sibling prefixes", () => {
    const paths = ["work.projects.alpha"];
    expect(pathExists(paths, "work.projects.alpha")).toBe(true);
    expect(pathExists(paths, "work")).toBe(true);
    expect(pathExists(paths, "work.proj")).toBe(false);
  });
});

describe("buildPathTree", () => {
  const rows = [
    { path: "work.projects.alpha", count: 2 },
    { path: "work.projects", count: 1 },
    { path: "home", count: 3 },
  ];

  it("adds ancestors with direct and total counts", () => {
    expect(buildPathTree(rows)).toEqual([
      { path: "home", notes: 3, total: 3 },
      { path: "work", notes: 0, total: 3 },
      { path: "work.projects", notes: 1, total: 3 },
      { path: "work.projects.alpha", notes: 2, total: 2 },
    ]);
  });

  it("filters to a prefix subtree", () => {
    expect(
      buildPathTree(rows, "work.projects").map((entry) => entry.path),
    ).toEqual(["work.projects", "work.projects.alpha"]);
  });
});
