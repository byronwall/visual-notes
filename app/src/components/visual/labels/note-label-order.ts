import type { DocItem } from "~/types/notes";
import { smoothstep, type Bounds, type Point } from "./label-geometry";

/**
 * Farthest-point ordering of notes, starting from the note farthest from the
 * viewport center (or the notes' centroid without a viewport). Long titles
 * are nudged later.
 */
export function buildStableNoteLabelOrder(args: {
  docs: DocItem[];
  positions: Map<string, Point>;
  /** Stop once this many ids are ordered; keeps dense views cheap. */
  limit?: number;
  viewportBounds?: Bounds;
}) {
  if (args.docs.length <= 1) return args.docs.map((doc) => doc.id);
  const center = args.viewportBounds
    ? {
        x: (args.viewportBounds.minX + args.viewportBounds.maxX) / 2,
        y: (args.viewportBounds.minY + args.viewportBounds.maxY) / 2,
      }
    : args.docs.reduce(
        (acc, doc) => {
          const pos = args.positions.get(doc.id);
          if (!pos) return acc;
          acc.x += pos.x;
          acc.y += pos.y;
          acc.count += 1;
          return acc;
        },
        { x: 0, y: 0, count: 0 },
      );
  const centerPoint =
    "count" in center
      ? {
          x: center.count > 0 ? center.x / center.count : 0,
          y: center.count > 0 ? center.y / center.count : 0,
        }
      : center;

  const entries: Array<{ doc: DocItem; pos: Point }> = [];
  for (const doc of args.docs) {
    const pos = args.positions.get(doc.id);
    if (pos) entries.push({ doc, pos });
  }
  if (entries.length === 0) return [];

  // Farthest-point ordering. Each candidate keeps its distance to the nearest
  // already-ordered note, refreshed only against the newest pick, so a pass
  // costs O(limit × notes) rather than O(limit² × notes).
  const count = entries.length;
  const baseScore = new Float64Array(count);
  const nearest = new Float64Array(count).fill(Number.POSITIVE_INFINITY);
  const taken = new Uint8Array(count);
  let firstIndex = -1;
  let firstDist = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < count; i++) {
    const { doc, pos } = entries[i]!;
    const centerDistance = Math.hypot(
      pos.x - centerPoint.x,
      pos.y - centerPoint.y,
    );
    if (centerDistance > firstDist) {
      firstDist = centerDistance;
      firstIndex = i;
    }
    const titlePenalty = Math.max(0, doc.title.length - 28) * 0.08;
    baseScore[i] = centerDistance * 0.22 - titlePenalty;
  }
  if (firstIndex < 0) return [];

  const ordered = [entries[firstIndex]!.doc.id];
  taken[firstIndex] = 1;
  let last = entries[firstIndex]!.pos;
  const limit = Math.min(args.limit ?? Number.POSITIVE_INFINITY, count);
  while (ordered.length < limit) {
    let bestIndex = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < count; i++) {
      if (taken[i]) continue;
      const pos = entries[i]!.pos;
      const dist = Math.hypot(pos.x - last.x, pos.y - last.y);
      if (dist < nearest[i]!) nearest[i] = dist;
      const score = nearest[i]! + baseScore[i]!;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    if (bestIndex < 0) break;
    taken[bestIndex] = 1;
    ordered.push(entries[bestIndex]!.doc.id);
    last = entries[bestIndex]!.pos;
  }

  return ordered;
}

/** How many note labels to show at this zoom, from 5 up to 13. */
export function getVisibleNoteLabelCount(args: {
  visibleCount: number;
  zoomScale: number;
}) {
  if (args.visibleCount <= 0) return 0;
  const minCount = Math.min(5, args.visibleCount);
  const maxCount = Math.min(13, args.visibleCount);
  if (minCount >= maxCount) return maxCount;
  const ratio = smoothstep(1.1, 2.35, args.zoomScale);
  return Math.max(
    minCount,
    Math.min(maxCount, Math.round(minCount + (maxCount - minCount) * ratio)),
  );
}
