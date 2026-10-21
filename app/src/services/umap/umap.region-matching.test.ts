import { describe, expect, it } from "vitest";
import type { UmapRegionItem } from "~/features/umap/region-types";
import { resolveUmapRegionId } from "~/features/umap/region-types";
import { matchRegionsToPrevious } from "./umap.region-matching";

function region(id: string, docIds: string[], title = id): UmapRegionItem {
  return {
    id,
    title,
    summary: `${title} summary`,
    docCount: docIds.length,
    docIds,
    centroid: { x: 0, y: 0 },
    radius: 1,
    bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
    islandId: "",
    sampleDocs: [],
    confidence: 50,
  };
}

const docs = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix}${i}`);

describe("matchRegionsToPrevious", () => {
  it("numbers regions from 1 without a previous snapshot", () => {
    const result = matchRegionsToPrevious(null, [
      region("tmp-a", docs("a", 4)),
      region("tmp-b", docs("b", 4)),
    ]);
    expect(result.regions.map((r) => r.id)).toEqual(["region-1", "region-2"]);
    expect(result.redirects).toEqual({});
  });

  it("keeps ids and titles of regions that barely changed", () => {
    const previous = {
      regions: [
        region("region-3", docs("a", 10), "Cooking"),
        region("region-7", docs("b", 10), "Travel"),
      ],
    };
    // Same clusters in a new order, each with one extra note.
    const result = matchRegionsToPrevious(previous, [
      region("region-1", [...docs("b", 10), "new-b"], "fresh label"),
      region("region-2", [...docs("a", 10), "new-a"], "fresh label"),
    ]);
    expect(result.regions.map((r) => [r.id, r.title])).toEqual([
      ["region-7", "Travel"],
      ["region-3", "Cooking"],
    ]);
    expect([...result.keptTitleIds].sort()).toEqual(["region-3", "region-7"]);
    expect(result.redirects).toEqual({});
  });

  it("redirects a merged region to the one that took its notes", () => {
    const previous = {
      regions: [
        region("region-1", docs("a", 12), "Big"),
        region("region-2", docs("b", 4), "Small"),
        region("region-3", docs("c", 8), "Other"),
      ],
    };
    const result = matchRegionsToPrevious(previous, [
      region("x", [...docs("a", 12), ...docs("b", 4)]),
      region("y", docs("c", 8)),
      region("z", docs("d", 6)),
    ]);
    const ids = result.regions.map((r) => r.id);
    expect(ids).toEqual(["region-1", "region-3", "region-4"]);
    expect(result.redirects).toEqual({ "region-2": "region-1" });
    expect(
      resolveUmapRegionId(
        { regions: result.regions, redirects: result.redirects },
        "region-2",
      ),
    ).toBe("region-1");
  });

  it("gives a reshaped region its id but a new label", () => {
    const previous = { regions: [region("region-5", docs("a", 10), "Old")] };
    const result = matchRegionsToPrevious(previous, [
      region("t", [...docs("a", 4), ...docs("n", 8)], "Relabel me"),
    ]);
    expect(result.regions[0]!.id).toBe("region-5");
    expect(result.regions[0]!.title).toBe("Relabel me");
    expect(result.keptTitleIds.size).toBe(0);
  });

  it("never reuses a retired id and carries old redirects forward", () => {
    const previous = {
      regions: [region("region-2", docs("a", 10))],
      redirects: { "region-9": "region-2", "region-4": "region-gone" },
    };
    const result = matchRegionsToPrevious(previous, [
      region("t1", docs("a", 10)),
      region("t2", docs("z", 10)),
    ]);
    expect(result.regions.map((r) => r.id)).toEqual(["region-2", "region-10"]);
    expect(result.redirects).toEqual({ "region-9": "region-2" });
  });

  it("drops overlaps below the threshold", () => {
    const previous = { regions: [region("region-1", docs("a", 20))] };
    const result = matchRegionsToPrevious(previous, [
      region("t", [...docs("a", 2), ...docs("q", 20)]),
    ]);
    expect(result.regions[0]!.id).toBe("region-2");
    // The old region still redirects to where its notes went.
    expect(result.redirects).toEqual({ "region-1": "region-2" });
  });
});

describe("resolveUmapRegionId", () => {
  it("returns live ids and null for unknown ones", () => {
    const snapshot = { regions: [region("region-1", [])], redirects: {} };
    expect(resolveUmapRegionId(snapshot, "region-1")).toBe("region-1");
    expect(resolveUmapRegionId(snapshot, "region-8")).toBeNull();
    expect(resolveUmapRegionId(null, "region-1")).toBeNull();
  });

  it("stops on redirect cycles", () => {
    const snapshot = {
      regions: [region("region-1", [])],
      redirects: { "region-2": "region-3", "region-3": "region-2" },
    };
    expect(resolveUmapRegionId(snapshot, "region-2")).toBeNull();
  });
});
