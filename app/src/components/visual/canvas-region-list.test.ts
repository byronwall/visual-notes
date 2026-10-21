import { describe, expect, it } from "vitest";
import type {
  UmapIslandItem,
  UmapRegionItem,
} from "~/features/umap/region-types";
import {
  formatRegionActivity,
  groupRegions,
  mapReadingOrder,
  regionActivity,
  type RegionActivity,
} from "./canvas-region-list";

const bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

const region = (
  id: string,
  islandId: string,
  x: number,
  y: number,
  docCount: number,
): UmapRegionItem => ({
  id,
  title: id,
  summary: "",
  docCount,
  docIds: [],
  centroid: { x, y },
  radius: 1,
  bounds,
  islandId,
  sampleDocs: [],
});

const island = (id: string, x: number, y: number): UmapIslandItem => ({
  id,
  title: `Island ${id}`,
  summary: "",
  regionIds: [],
  docCount: 0,
  centroid: { x, y },
  radius: 1,
  bounds,
});

describe("mapReadingOrder", () => {
  it("reads the top band left to right before lower bands", () => {
    const points = [
      { id: "bottom-left", x: -10, y: 30 },
      { id: "top-right", x: 10, y: -20 },
      { id: "top-left", x: -10, y: -18 },
    ];
    expect(mapReadingOrder(points, (p) => p).map((p) => p.id)).toEqual([
      "top-left",
      "top-right",
      "bottom-left",
    ]);
  });
});

describe("regionActivity", () => {
  it("finds the newest edit and counts this week's changes", () => {
    const now = Date.parse("2026-10-20T12:00:00Z");
    const updated = new Map([
      ["a", "2026-10-19T12:00:00.000Z"],
      ["b", "2026-09-01T12:00:00.000Z"],
      ["c", "2026-10-18T12:00:00.000Z"],
    ]);
    expect(regionActivity(["a", "b", "c", "missing"], updated, now)).toEqual({
      lastUpdatedAt: "2026-10-19T12:00:00.000Z",
      changedThisWeek: 2,
    });
  });

  it("formats nothing when no note timestamps are known", () => {
    expect(
      formatRegionActivity({ lastUpdatedAt: null, changedThisWeek: 0 }),
    ).toBeNull();
  });
});

describe("groupRegions", () => {
  const regions = [
    region("south", "low", 0, 30, 5),
    region("east", "high", 20, -20, 9),
    region("west", "high", -20, -20, 2),
    region("stray", "gone", 0, 0, 1),
  ];
  const islands = [island("low", 0, 30), island("high", 0, -20)];

  it("groups by island in map order and keeps orphans last", () => {
    const groups = groupRegions(regions, islands, "map", new Map());
    expect(groups.map((g) => [g.title, g.regions.map((r) => r.id)])).toEqual([
      ["Island high", ["west", "east"]],
      ["Island low", ["south"]],
      ["Other", ["stray"]],
    ]);
    expect(groups[0].docCount).toBe(11);
  });

  it("flattens for size and recent sorts", () => {
    const activity = new Map<string, RegionActivity>([
      ["west", { lastUpdatedAt: "2026-10-19", changedThisWeek: 1 }],
      ["south", { lastUpdatedAt: "2026-10-01", changedThisWeek: 0 }],
    ]);
    const ids = (sort: "size" | "recent") =>
      groupRegions(regions, islands, sort, activity)[0].regions.map(
        (r) => r.id,
      );
    expect(ids("size")).toEqual(["east", "south", "west", "stray"]);
    expect(ids("recent").slice(0, 2)).toEqual(["west", "south"]);
  });
});
