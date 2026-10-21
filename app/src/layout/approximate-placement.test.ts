import { describe, expect, it } from "vitest";
import { placeApproximate, type PlacedPoint } from "./approximate-placement";

const MIN_SEP = 22;

function knownMap(entries: [string, number, number][]) {
  return new Map<string, PlacedPoint>(
    entries.map(([id, x, y]) => [id, { x, y }]),
  );
}

const dist = (a: PlacedPoint, b: PlacedPoint) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe("placeApproximate", () => {
  const known = knownMap([
    ["a1", -500, -500],
    ["a2", -480, -510],
    ["b1", 500, 400],
    ["b2", 520, 410],
    ["c1", 0, 0],
  ]);
  const placedDocs = [
    { id: "a1", title: "a1", path: "work.alpha" },
    { id: "a2", title: "a2", path: "work.alpha" },
    { id: "b1", title: "b1", collection: { id: "books" } },
    { id: "b2", title: "b2", collection: { id: "books" } },
    { id: "c1", title: "c1", meta: { tag: "garden" } },
  ];

  it("puts new notes beside their collection, folder, or meta neighbors", () => {
    const result = placeApproximate({
      docs: [
        ...placedDocs,
        { id: "n-book", title: "x", collection: { id: "books" } },
        { id: "n-alpha", title: "y", path: "work.alpha.sub" },
        { id: "n-garden", title: "z", meta: { tag: "Garden" } },
      ],
      known,
      minSep: MIN_SEP,
      spread: 1000,
    });
    expect(result.size).toBe(3);
    expect(dist(result.get("n-book")!, known.get("b1")!)).toBeLessThan(80);
    expect(dist(result.get("n-alpha")!, known.get("a1")!)).toBeLessThan(80);
    expect(dist(result.get("n-garden")!, known.get("c1")!)).toBeLessThan(80);
    for (const p of result.values()) expect(p.approximate).toBe(true);
  });

  it("clusters unrelated notes loosely below the map without overlap", () => {
    const orphans = Array.from({ length: 40 }, (_, i) => ({
      id: `orphan-${i}`,
      title: `Orphan ${i}`,
    }));
    const result = placeApproximate({
      docs: [...placedDocs, ...orphans],
      known,
      minSep: MIN_SEP,
      spread: 1000,
    });
    const points = [...result.values()];
    expect(points).toHaveLength(40);
    for (const p of points) expect(p.y).toBeGreaterThan(410);
    const all = [...known.values(), ...points];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(dist(all[i]!, all[j]!)).toBeGreaterThanOrEqual(MIN_SEP - 1e-9);
      }
    }
    // Not a grid: rows would repeat a handful of distinct y values.
    const rows = new Set(points.map((p) => Math.round(p.y)));
    expect(rows.size).toBeGreaterThan(30);
  });

  it("is deterministic", () => {
    const input = {
      docs: [...placedDocs, { id: "n1", title: "n1", path: "work.alpha" }],
      known,
      minSep: MIN_SEP,
      spread: 1000,
    };
    expect(placeApproximate(input)).toEqual(placeApproximate(input));
  });
});
