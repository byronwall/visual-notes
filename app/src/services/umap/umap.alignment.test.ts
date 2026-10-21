import { describe, expect, it } from "vitest";
import {
  applyAlignment,
  fitSimilarityTransform,
  type Point2,
} from "./umap.alignment";

function makeCloud(count: number): Point2[] {
  // Deterministic, asymmetric points so a reflection is distinguishable.
  return Array.from({ length: count }, (_, i) => ({
    x: Math.cos(i * 1.7) * (i + 1) * 0.3 + i * 0.05,
    y: Math.sin(i * 0.9) * (i % 7) * 0.4 - i * 0.02,
  }));
}

function transform(
  points: Point2[],
  opts: {
    angle: number;
    scale: number;
    reflect: boolean;
    dx: number;
    dy: number;
  },
): Point2[] {
  return points.map((p) => {
    const y = opts.reflect ? -p.y : p.y;
    const cos = Math.cos(opts.angle);
    const sin = Math.sin(opts.angle);
    return {
      x: opts.scale * (cos * p.x - sin * y) + opts.dx,
      y: opts.scale * (sin * p.x + cos * y) + opts.dy,
    };
  });
}

describe("fitSimilarityTransform", () => {
  const original = makeCloud(40);

  it.each([
    { angle: 0.8, scale: 2.5, reflect: false, dx: 4, dy: -7 },
    { angle: -2.1, scale: 0.4, reflect: true, dx: -3, dy: 1 },
    { angle: Math.PI, scale: 1, reflect: true, dx: 0, dy: 0 },
  ])("recovers the original from a moved copy %o", (opts) => {
    const moved = transform(original, opts);
    const alignment = fitSimilarityTransform(moved, original);
    expect(alignment).not.toBeNull();
    expect(alignment!.reflected).toBe(opts.reflect);
    expect(alignment!.scale).toBeCloseTo(1 / opts.scale, 6);
    expect(alignment!.rms).toBeLessThan(1e-9);
    moved.forEach((point, i) => {
      const aligned = applyAlignment(alignment!, point);
      expect(aligned.x).toBeCloseTo(original[i]!.x, 6);
      expect(aligned.y).toBeCloseTo(original[i]!.y, 6);
    });
  });

  it("fits noisy pairs in least squares", () => {
    const moved = transform(original, {
      angle: 1.2,
      scale: 3,
      reflect: false,
      dx: 2,
      dy: 2,
    }).map((p, i) => ({ x: p.x + (i % 2 ? 0.01 : -0.01), y: p.y }));
    const alignment = fitSimilarityTransform(moved, original)!;
    expect(alignment.reflected).toBe(false);
    expect(alignment.rms).toBeLessThan(0.01);
  });

  it("refuses too few or degenerate pairs", () => {
    expect(fitSimilarityTransform(original.slice(0, 2), original)).toBeNull();
    const same = Array.from({ length: 5 }, () => ({ x: 1, y: 1 }));
    expect(fitSimilarityTransform(same, original.slice(0, 5))).toBeNull();
  });
});
