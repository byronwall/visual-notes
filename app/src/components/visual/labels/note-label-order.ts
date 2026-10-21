import type { DocItem } from "~/types/notes";
import { smoothstep, type Bounds, type Point } from "./label-geometry";

/**
 * The note-label ranking rule: among notes inside the settled view, the
 * most recently edited come first (ties by title, then id). Placement then
 * walks this list, skips any note whose label would overlap one already
 * placed, and stops at the zoom's count. The rank ignores hover, pan
 * distance, and the live zoom, so the same view always shows the same
 * labels.
 */
export function rankNoteLabelCandidates(args: {
  docs: DocItem[];
  positions: Map<string, Point>;
  bounds?: Bounds;
  limit?: number;
}) {
  const { bounds } = args;
  const inView = args.docs.filter((doc) => {
    const pos = args.positions.get(doc.id);
    if (!pos) return false;
    return (
      !bounds ||
      (pos.x >= bounds.minX &&
        pos.x <= bounds.maxX &&
        pos.y >= bounds.minY &&
        pos.y <= bounds.maxY)
    );
  });
  inView.sort(
    (a, b) =>
      b.updatedAt.localeCompare(a.updatedAt) ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id),
  );
  return inView.slice(0, args.limit ?? inView.length).map((doc) => doc.id);
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
