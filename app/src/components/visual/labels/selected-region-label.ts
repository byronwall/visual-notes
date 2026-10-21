import type { UmapRegionItem } from "~/features/umap/region-types";
import {
  clamp,
  computeLabelBox,
  shiftLabelBoxIntoBounds,
  wrapRegionTitle,
  type Bounds,
  type Point,
} from "./label-geometry";
import {
  measureRegionLabel,
  regionDrawRadius,
  snapRegionLabelLayout,
  type RegionLabelLayout,
} from "./region-label-geometry";

/**
 * The selected region's label while zoomed in on it (below inside-label
 * zoom): pinned above-right of the circle with a leader, then nudged into
 * the viewport. Note labels treat it as occupied space.
 */
export function buildFixedSelectedRegionLabelLayout(args: {
  region: UmapRegionItem;
  zoomScale: number;
  offset: Point;
  labelFontSize: number;
  viewportBounds?: Bounds;
}) {
  const { region, zoomScale, labelFontSize } = args;
  const lines = wrapRegionTitle(region.title, 16, 3);
  const { labelWidth, labelHeight } = measureRegionLabel({
    lines,
    zoomScale,
    labelFontSize,
  });
  const radius = regionDrawRadius(region);
  const box = shiftLabelBoxIntoBounds(
    computeLabelBox({
      textAnchor: "start",
      textX: region.centroid.x + radius * 0.62 + 20 / zoomScale,
      topY:
        region.centroid.y - radius * 0.98 - labelHeight * 0.96 - 12 / zoomScale,
      labelWidth,
      labelHeight,
      labelFontSize,
    }),
    args.viewportBounds,
  );
  const leaderEndX = clamp(region.centroid.x, box.minX, box.maxX);
  const leaderEndY = clamp(region.centroid.y, box.minY, box.maxY);
  const dx = leaderEndX - region.centroid.x;
  const dy = leaderEndY - region.centroid.y;
  const leaderLength = Math.max(1, Math.hypot(dx, dy));
  return snapRegionLabelLayout(
    {
      regionId: region.id,
      lines,
      textAnchor: "start" as const,
      textX: box.minX,
      textY: box.textY,
      minX: box.minX,
      minY: box.minY,
      maxX: box.maxX,
      maxY: box.maxY,
      showLeader: true,
      leaderEndX,
      leaderEndY,
      elbowX: leaderEndX - 2.5 / zoomScale,
      elbowY: leaderEndY,
      edgeX: region.centroid.x + (dx / leaderLength) * radius,
      edgeY: region.centroid.y + (dy / leaderLength) * radius,
    } satisfies RegionLabelLayout,
    { zoomScale, offset: args.offset },
  );
}
