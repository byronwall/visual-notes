import type { UmapRegionItem } from "~/features/umap/region-types";
import type { Bounds, Point } from "../labels/label-geometry";

/**
 * A region's drawn shape in world units: the convex hull of its notes,
 * padded by a round margin. Convex keeps the shape a single, predictable
 * click target that never self-intersects; the round padding makes it soft.
 */
export type RegionShape = {
  regionId: string;
  /** SVG path in world units (straight edges joined by exact arcs). */
  path: string;
  /** The same outline sampled as a polygon, for hit tests and labels. */
  outline: Point[];
  bounds: Bounds;
  /** Area centroid of the hull; always inside the shape. */
  center: Point;
};

const ARC_STEP = Math.PI / 10;
/** Points farther than this many median distances from the center are outliers. */
const OUTLIER_FACTOR = 2.6;

export function convexHull(points: Point[]): Point[] {
  const sorted = points
    .slice()
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .filter(
      (p, i, all) => i === 0 || p.x !== all[i - 1]!.x || p.y !== all[i - 1]!.y,
    );
  if (sorted.length <= 2) return sorted;
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  // Counter-clockwise in math axes, which is clockwise on screen (y down).
  return lower.concat(upper);
}

/** Drops far stragglers so one stray note does not balloon the shape. */
export function trimOutliers(points: Point[]): Point[] {
  if (points.length < 6) return points;
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const distances = points.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const sorted = distances.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  if (median <= 0) return points;
  const kept = points.filter(
    (_, i) => distances[i]! <= median * OUTLIER_FACTOR,
  );
  return kept.length >= 3 ? kept : points;
}

function polygonCentroid(hull: Point[]): Point {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!;
    const b = hull[(i + 1) % hull.length]!;
    const f = a.x * b.y - b.x * a.y;
    area += f;
    cx += (a.x + b.x) * f;
    cy += (a.y + b.y) * f;
  }
  if (Math.abs(area) < 1e-9) {
    return {
      x: hull.reduce((sum, p) => sum + p.x, 0) / hull.length,
      y: hull.reduce((sum, p) => sum + p.y, 0) / hull.length,
    };
  }
  return { x: cx / (3 * area), y: cy / (3 * area) };
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Outline of `hull` grown by `pad`: each edge pushed out along its normal,
 * with a circular arc around every vertex. One or two points become a
 * circle or a capsule.
 */
function padHull(hull: Point[], pad: number) {
  const outline: Point[] = [];
  const n = hull.length;
  if (n === 1) {
    const c = hull[0]!;
    for (let a = 0; a < Math.PI * 2; a += ARC_STEP) {
      outline.push({ x: c.x + Math.cos(a) * pad, y: c.y + Math.sin(a) * pad });
    }
    const path = `M ${round(c.x + pad)} ${round(c.y)} A ${round(pad)} ${round(pad)} 0 1 1 ${round(c.x - pad)} ${round(c.y)} A ${round(pad)} ${round(pad)} 0 1 1 ${round(c.x + pad)} ${round(c.y)} Z`;
    return { outline, path };
  }

  // Outward normal of edge i (from hull[i] to hull[i+1]). The hull runs
  // counter-clockwise in math axes, so the outward normal is (dy, -dx).
  const normals = hull.map((a, i) => {
    const b = hull[(i + 1) % n]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.y - a.y) / len, y: -(b.x - a.x) / len };
  });
  const segments: string[] = [];
  for (let i = 0; i < n; i++) {
    const vertex = hull[i]!;
    const inNormal = normals[(i - 1 + n) % n]!;
    const outNormal = normals[i]!;
    const start = Math.atan2(inNormal.y, inNormal.x);
    let end = Math.atan2(outNormal.y, outNormal.x);
    // Walking the hull, the normal turns the same way at every vertex: by
    // under half a turn on a convex hull, exactly half on a capsule end.
    while (end < start) end += Math.PI * 2;
    const arcStart = {
      x: vertex.x + Math.cos(start) * pad,
      y: vertex.y + Math.sin(start) * pad,
    };
    const arcEnd = {
      x: vertex.x + Math.cos(end) * pad,
      y: vertex.y + Math.sin(end) * pad,
    };
    segments.push(
      `${i === 0 ? "M" : "L"} ${round(arcStart.x)} ${round(arcStart.y)}`,
      `A ${round(pad)} ${round(pad)} 0 0 1 ${round(arcEnd.x)} ${round(arcEnd.y)}`,
    );
    for (let a = start; a < end; a += ARC_STEP) {
      outline.push({
        x: vertex.x + Math.cos(a) * pad,
        y: vertex.y + Math.sin(a) * pad,
      });
    }
    outline.push(arcEnd);
  }
  segments.push("Z");
  return { outline, path: segments.join(" ") };
}

function boundsOf(points: Point[]): Bounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Shape for one region from its notes' positions. The padding scales with
 * the region's spread so small and large regions both read as soft blobs;
 * a region with no placed notes falls back to its stored circle.
 */
export function buildRegionShape(
  region: Pick<UmapRegionItem, "id" | "centroid" | "radius">,
  points: Point[],
): RegionShape {
  const kept = trimOutliers(points);
  const hull = kept.length > 0 ? convexHull(kept) : [region.centroid];
  const spread = hull.length > 1 ? boundsOf(hull) : undefined;
  const extent = spread
    ? Math.max(spread.maxX - spread.minX, spread.maxY - spread.minY)
    : 0;
  const pad =
    hull.length === 1 && kept.length === 0
      ? Math.max(18, region.radius)
      : Math.max(14, Math.min(48, extent * 0.12));
  const { outline, path } = padHull(hull, pad);
  return {
    regionId: region.id,
    path,
    outline,
    bounds: boundsOf(outline),
    center: polygonCentroid(hull),
  };
}

export function buildRegionShapes(
  regions: UmapRegionItem[],
  positions: Map<string, Point>,
) {
  const shapes = new Map<string, RegionShape>();
  for (const region of regions) {
    const points: Point[] = [];
    for (const docId of region.docIds) {
      const pos = positions.get(docId);
      if (pos) points.push(pos);
    }
    shapes.set(region.id, buildRegionShape(region, points));
  }
  return shapes;
}

/** Even-odd point-in-polygon test against a shape's sampled outline. */
export function shapeContains(shape: RegionShape, point: Point) {
  const { bounds, outline } = shape;
  if (
    point.x < bounds.minX ||
    point.x > bounds.maxX ||
    point.y < bounds.minY ||
    point.y > bounds.maxY
  ) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!;
    const b = outline[j]!;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}
