import type { UmapRegionItem } from "~/features/umap/region-types";
import { SPREAD, smoothstep } from "./label-geometry";

/**
 * Orders region ids so each next pick is far from the ones already picked,
 * weighted by size and centrality. Depends only on the regions, so the order
 * holds across zoom levels; zooming only changes how many are shown.
 */
export function buildStableRegionLabelOrder(regions: UmapRegionItem[]) {
  if (regions.length <= 1) {
    return regions.map((region) => region.id);
  }

  const baseSorted = regions
    .slice()
    .sort(
      (a, b) =>
        b.docCount - a.docCount ||
        b.radius - a.radius ||
        a.title.localeCompare(b.title),
    );
  const maxDocCount = Math.max(...regions.map((region) => region.docCount), 1);
  const maxRadius = Math.max(...regions.map((region) => region.radius), 1);
  const center = regions.reduce(
    (acc, region) => ({
      x: acc.x + region.centroid.x,
      y: acc.y + region.centroid.y,
    }),
    { x: 0, y: 0 },
  );
  center.x /= regions.length;
  center.y /= regions.length;
  const maxCenterDistance = Math.max(
    ...regions.map((region) =>
      Math.hypot(region.centroid.x - center.x, region.centroid.y - center.y),
    ),
    1,
  );

  const ordered = [baseSorted[0]!];
  const remaining = new Map(
    baseSorted.slice(1).map((region) => [region.id, region]),
  );

  while (remaining.size > 0) {
    let bestId: string | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const [regionId, region] of remaining) {
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const selected of ordered) {
        nearestDistance = Math.min(
          nearestDistance,
          Math.hypot(
            region.centroid.x - selected.centroid.x,
            region.centroid.y - selected.centroid.y,
          ),
        );
      }
      const gapScore = nearestDistance / SPREAD;
      const sizeScore =
        region.docCount / maxDocCount + region.radius / maxRadius;
      const centerDistance = Math.hypot(
        region.centroid.x - center.x,
        region.centroid.y - center.y,
      );
      const centralityScore = 1 - centerDistance / maxCenterDistance;
      const score = gapScore * 0.62 + sizeScore * 0.28 + centralityScore * 0.1;

      if (score > bestScore) {
        bestScore = score;
        bestId = regionId;
      }
    }

    if (!bestId) break;
    ordered.push(remaining.get(bestId)!);
    remaining.delete(bestId);
  }

  return ordered.map((region) => region.id);
}

/** How many region labels to show at this zoom (a prefix of the order). */
export function getVisibleRegionLabelCount(args: {
  regionCount: number;
  zoomScale: number;
  regionsOnly: boolean;
}) {
  if (args.regionCount <= 0) return 0;
  const minCount = Math.min(args.regionsOnly ? 18 : 12, args.regionCount);
  const maxCount = Math.min(args.regionsOnly ? 54 : 42, args.regionCount);
  if (minCount >= maxCount) return maxCount;
  const ratio = smoothstep(
    args.regionsOnly ? 0.34 : 0.44,
    args.regionsOnly ? 1.1 : 0.9,
    args.zoomScale,
  );
  return Math.max(
    minCount,
    Math.min(maxCount, Math.round(minCount + (maxCount - minCount) * ratio)),
  );
}
