import type { DocItem } from "~/types/notes";
import { buildKdTree, kdNearest } from "~/spatial/kdtree";

type Point = { x: number; y: number };

export async function nudgePositions(params: {
  docs: DocItem[];
  startPositions: Map<string, Point>;
  basePositions: Map<string, Point>;
  minSeparation: number;
  spread: number;
  iterations?: number;
}): Promise<{
  adjustments: Map<string, Point>;
  stats?: Record<string, number>;
}> {
  const {
    docs,
    startPositions,
    basePositions,
    minSeparation: MIN_SEP,
    spread: SPREAD,
    iterations = 200,
  } = params;

  // Work on a copy of positions
  let cur = new Map<string, Point>(startPositions);

  function toArray(): { x: number; y: number; id: string }[] {
    const arr: { x: number; y: number; id: string }[] = [];
    for (const d of docs) {
      const p = cur.get(d.id);
      if (p) arr.push({ x: p.x, y: p.y, id: d.id });
    }
    return arr;
  }

  for (let it = 0; it < iterations; it++) {
    const pointsArr = toArray();
    const tree = buildKdTree(pointsArr);
    const accum = new Map<string, { dx: number; dy: number }>();

    // Congestion measurement in central region
    const centerR = SPREAD * 0.1;
    let inside = 0;
    let overlapped = 0;
    let overlapEnergy = 0;
    for (const pt of pointsArr) {
      const r = Math.hypot(pt.x, pt.y);
      if (r > centerR) continue;
      inside++;
      const nn = kdNearest(tree, { x: pt.x, y: pt.y }, pt.id);
      if (nn.dist2 !== undefined && isFinite(nn.dist2)) {
        const nnDist = Math.sqrt(nn.dist2);
        if (nnDist < MIN_SEP) {
          overlapped++;
          overlapEnergy += MIN_SEP - nnDist;
        }
      }
    }
    const overlappedFrac = inside > 0 ? overlapped / inside : 0;
    const avgOverlap = inside > 0 ? overlapEnergy / inside : 0;
    const congestion = Math.max(
      0,
      Math.min(1, 0.5 * overlappedFrac + 0.5 * (avgOverlap / MIN_SEP))
    );
    if (it % 50 === 0 && (inside > 0 || congestion > 0)) {
      try {
        console.log(
          `[nudge] it=${it} congestion=${congestion.toFixed(
            2
          )} centerCount=${inside}`
        );
      } catch {}
    }

    // Scale forces with congestion
    const congestionSq = congestion * congestion;
    const stiffness = 0.3 * (1 + 5.0 * congestion + 8.0 * congestionSq);
    const maxStep = 2.0 * (1 + 4.0 * congestion);

    // Pairwise nearest-neighbor repulsion
    for (const d of docs) {
      const p = cur.get(d.id);
      if (!p) continue;
      const nn = kdNearest(tree, p, d.id);
      if (!nn.id || nn.dist2 === undefined || !isFinite(nn.dist2)) continue;
      const q = cur.get(nn.id);
      if (!q) continue;
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const dist = Math.hypot(dx, dy);
      const target = MIN_SEP * (1 + 0.4 * congestion);
      if (dist < target) {
        const overlap = target - (dist === 0 ? 0.001 : dist);
        const ux = dist === 0 ? 1 : dx / dist;
        const uy = dist === 0 ? 0 : dy / dist;
        const mag = Math.min(overlap * stiffness, maxStep);
        const halfX = (ux * mag) / 2;
        const halfY = (uy * mag) / 2;
        const a = accum.get(d.id) || { dx: 0, dy: 0 };
        a.dx += halfX;
        a.dy += halfY;
        accum.set(d.id, a);
        const b = accum.get(nn.id) || { dx: 0, dy: 0 };
        b.dx -= halfX;
        b.dy -= halfY;
        accum.set(nn.id, b);
      } else if (dist < target * 1.5) {
        const overlap = target * 1.5 - dist;
        const ux = dx / (dist === 0 ? 1 : dist);
        const uy = dy / (dist === 0 ? 1 : dist);
        const mag = Math.min(overlap * (stiffness * 0.25), maxStep * 0.5);
        const halfX = (ux * mag) / 2;
        const halfY = (uy * mag) / 2;
        const a = accum.get(d.id) || { dx: 0, dy: 0 };
        a.dx += halfX;
        a.dy += halfY;
        accum.set(d.id, a);
        const b = accum.get(nn.id) || { dx: 0, dy: 0 };
        b.dx -= halfX;
        b.dy -= halfY;
        accum.set(nn.id, b);
      }
    }

    // Outward radial force to relieve central congestion
    if (congestion > 0 && inside > 0) {
      const outwardBase = 12.0;
      for (const d of docs) {
        const p = cur.get(d.id);
        if (!p) continue;
        const r = Math.hypot(p.x, p.y);
        if (r >= centerR) continue;
        const falloff = 1 - r / centerR;
        const radialMag =
          outwardBase * (0.5 + 2.0 * congestion + 1.3 * congestionSq) * falloff;
        if (radialMag <= 0) continue;
        const ux = r === 0 ? 1 : p.x / r;
        const uy = r === 0 ? 0 : p.y / r;
        const a = accum.get(d.id) || { dx: 0, dy: 0 };
        const step = Math.min(radialMag, maxStep * 4);
        a.dx += ux * step;
        a.dy += uy * step;
        accum.set(d.id, a);
      }
    }

    if (accum.size === 0) break;

    // Apply accumulated displacements
    for (const [id, { dx, dy }] of accum) {
      const p = cur.get(id);
      if (!p) continue;
      cur.set(id, { x: p.x + dx, y: p.y + dy });
    }

    if (it % 10 === 9) await Promise.resolve();
  }

  // Compute adjustments relative to base positions
  const adjustments = new Map<string, Point>();
  for (const [id, p] of cur) {
    const b = basePositions.get(id);
    if (!b) continue;
    adjustments.set(id, { x: p.x - b.x, y: p.y - b.y });
  }

  return {
    adjustments,
    stats: undefined,
  };
}
