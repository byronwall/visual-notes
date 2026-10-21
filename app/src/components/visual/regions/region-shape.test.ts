import { describe, expect, it } from "vitest";
import { seededRandom } from "../labels/test-fixtures";
import { assignRegionTones, mixHslColors } from "./region-colors";
import {
  buildRegionShape,
  convexHull,
  shapeContains,
  trimOutliers,
} from "./region-shape";

const region = { id: "r", centroid: { x: 0, y: 0 }, radius: 40 };

function cluster(count: number, seed = 3) {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => ({
    x: 300 + (random() - 0.5) * 200,
    y: 120 + (random() - 0.5) * 80,
  }));
}

describe("convexHull", () => {
  it("keeps only the corners of a square with interior points", () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 5, y: 5 },
      { x: 3, y: 7 },
    ]);
    expect(hull).toHaveLength(4);
  });
});

describe("trimOutliers", () => {
  it("drops one far straggler", () => {
    const points = [...cluster(30), { x: 5000, y: 5000 }];
    expect(trimOutliers(points)).toHaveLength(30);
  });
});

describe("buildRegionShape", () => {
  it("contains every note with room to spare", () => {
    const points = cluster(40);
    const shape = buildRegionShape(region, points);
    for (const point of points) expect(shapeContains(shape, point)).toBe(true);
    expect(shapeContains(shape, shape.center)).toBe(true);
    expect(shapeContains(shape, { x: 0, y: 0 })).toBe(false);
  });

  it("draws a closed path with arcs", () => {
    const shape = buildRegionShape(region, cluster(12));
    expect(shape.path.startsWith("M ")).toBe(true);
    expect(shape.path.endsWith("Z")).toBe(true);
    expect(shape.path).toContain(" A ");
  });

  it("handles one, two, and zero points", () => {
    const one = buildRegionShape(region, [{ x: 10, y: 10 }]);
    expect(shapeContains(one, { x: 12, y: 12 })).toBe(true);
    const two = buildRegionShape(region, [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(shapeContains(two, { x: 50, y: 0 })).toBe(true);
    expect(shapeContains(two, { x: 50, y: 60 })).toBe(false);
    const none = buildRegionShape(region, []);
    expect(shapeContains(none, { x: 30, y: 0 })).toBe(true);
  });
});

describe("assignRegionTones", () => {
  it("gives touching regions different hues", () => {
    const box = (x: number) => ({
      regionId: `r${x}`,
      bounds: { minX: x, minY: 0, maxX: x + 100, maxY: 100 },
    });
    const tones = assignRegionTones([box(0), box(90), box(180)]);
    expect(tones.get("r0")!.hue).not.toBe(tones.get("r90")!.hue);
    expect(tones.get("r90")!.hue).not.toBe(tones.get("r180")!.hue);
  });
});

describe("mixHslColors", () => {
  it("returns the ends and mixes in between", () => {
    expect(mixHslColors("hsl(0 100% 50%)", "hsl(240 100% 50%)", 0)).toBe(
      "hsl(0 100% 50%)",
    );
    expect(mixHslColors("hsl(0 100% 50%)", "hsl(240 100% 50%)", 0.5)).toBe(
      "rgb(128, 0, 128)",
    );
  });
});
