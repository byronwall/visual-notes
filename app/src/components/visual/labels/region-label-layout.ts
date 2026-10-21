import type { UmapRegionItem } from "~/features/umap/region-types";
import {
  clamp,
  computeLabelBox,
  measureBoxOverlap,
  measureShiftIntoBounds,
  shiftLabelBox,
  shiftLabelBoxIntoBounds,
  wrapRegionTitle,
  type Bounds,
  type LabelBox,
  type LabelTextAnchor,
  type Point,
} from "./label-geometry";
import {
  SELECTED_REGION_INSIDE_LABEL_ZOOM,
  measureRegionBoxContest,
  measureRegionLabel,
  regionDrawRadius,
  snapRegionLabelLayout,
  type RegionLabelLayout,
} from "./region-label-geometry";

type RegionLabelCandidate = {
  showLeader: boolean;
  box: LabelBox;
  textAnchor: LabelTextAnchor;
  textX: number;
  score: number;
};

type PlacementContext = {
  regions: UmapRegionItem[];
  zoomScale: number;
  labelFontSize: number;
  viewportBounds?: Bounds;
  placed: Bounds[];
  labelSpacingX: number;
  labelSpacingY: number;
};

/**
 * Places region labels greedily in order. Each label tries three spots
 * outside its circle (with a leader line) and two inside, and keeps the one
 * with the lowest penalty against labels already placed, the viewport, and
 * other region circles.
 */
export function buildRegionLabelLayouts(args: {
  regions: UmapRegionItem[];
  labeledIds: Set<string>;
  labelOrder?: string[];
  emphasizedIds?: Set<string>;
  zoomScale: number;
  offset: Point;
  labelFontSize: number;
  allowRegionOverlap?: boolean;
  viewportBounds?: Bounds;
  occupiedBoxes?: Bounds[];
}) {
  const regionById = new Map(args.regions.map((region) => [region.id, region]));
  const explicitOrder = args.labelOrder
    ?.map((regionId) => regionById.get(regionId))
    .filter((region): region is NonNullable<typeof region> => !!region)
    .filter((region) => args.labeledIds.has(region.id));
  const selected = (
    explicitOrder ??
    args.regions.filter((region) => args.labeledIds.has(region.id)).slice()
  ).sort((a, b) => {
    const aEmphasized = args.emphasizedIds?.has(a.id) ?? false;
    const bEmphasized = args.emphasizedIds?.has(b.id) ?? false;
    if (aEmphasized && !bEmphasized) return -1;
    if (bEmphasized && !aEmphasized) return 1;
    if (explicitOrder) return 0;
    return b.docCount - a.docCount || b.radius - a.radius;
  });

  const context: PlacementContext = {
    regions: args.regions,
    zoomScale: args.zoomScale,
    labelFontSize: args.labelFontSize,
    viewportBounds: args.viewportBounds,
    placed: [...(args.occupiedBoxes ?? [])],
    labelSpacingX: 12 / args.zoomScale,
    labelSpacingY: 9 / args.zoomScale,
  };
  const layouts: RegionLabelLayout[] = [];

  for (const region of selected) {
    const isSelected = args.emphasizedIds?.has(region.id) ?? false;
    const canOverlapSelectedRegion =
      isSelected && args.zoomScale >= SELECTED_REGION_INSIDE_LABEL_ZOOM;
    const best =
      isSelected && !canOverlapSelectedRegion
        ? placeSelectedRegionLabel(region, context)
        : placeRegionLabel(region, context, {
            isSelected,
            canOverlapSelectedRegion,
          });
    if (!best) continue;
    const snappedBest = snapRegionLabelLayout(best, {
      zoomScale: args.zoomScale,
      offset: args.offset,
    });
    context.placed.push({
      minX: snappedBest.minX - context.labelSpacingX,
      minY: snappedBest.minY - context.labelSpacingY,
      maxX: snappedBest.maxX + context.labelSpacingX,
      maxY: snappedBest.maxY + context.labelSpacingY,
    });
    layouts.push(snappedBest);
  }

  return layouts;
}

/** Selected region below inside-label zoom: fixed spot above-right. */
function placeSelectedRegionLabel(
  region: UmapRegionItem,
  context: PlacementContext,
): RegionLabelLayout & { score: number } {
  const { zoomScale, labelFontSize } = context;
  const lines = wrapRegionTitle(region.title, 16, 3);
  const radius = regionDrawRadius(region);
  const { labelWidth, labelHeight } = measureRegionLabel({
    lines,
    zoomScale,
    labelFontSize,
  });
  const box = shiftLabelBoxIntoBounds(
    computeLabelBox({
      textAnchor: "start",
      textX: region.centroid.x + radius + 18 / zoomScale,
      topY: region.centroid.y - radius - labelHeight - 8 / zoomScale,
      labelWidth,
      labelHeight,
      labelFontSize,
    }),
    context.viewportBounds,
  );
  const leaderEndX = clamp(region.centroid.x, box.minX, box.maxX);
  const leaderEndY = clamp(region.centroid.y, box.minY, box.maxY);
  const dx = leaderEndX - region.centroid.x;
  const dy = leaderEndY - region.centroid.y;
  const leaderLength = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  return {
    regionId: region.id,
    lines,
    textAnchor: "start",
    textX: box.minX,
    textY: box.textY,
    showLeader: true,
    leaderEndX,
    leaderEndY,
    elbowX: leaderEndX - 2.5 / zoomScale,
    elbowY: leaderEndY,
    edgeX: region.centroid.x + (dx / leaderLength) * radius,
    edgeY: region.centroid.y + (dy / leaderLength) * radius,
    minX: box.minX,
    minY: box.minY,
    maxX: box.maxX,
    maxY: box.maxY,
    score: 0,
  };
}

function placeRegionLabel(
  region: UmapRegionItem,
  context: PlacementContext,
  flags: { isSelected: boolean; canOverlapSelectedRegion: boolean },
): (RegionLabelLayout & { score: number }) | undefined {
  const { zoomScale } = context;
  const lines = wrapRegionTitle(region.title, 16, 3);
  const radius = regionDrawRadius(region);
  const candidates = [
    ...buildExternalCandidates(region, lines, context, flags.isSelected),
    ...buildInsideCandidates(region, lines, context, flags),
  ];
  const rankedCandidates = candidates.slice().sort((a, b) => a.score - b.score);
  const chosen =
    flags.isSelected && !flags.canOverlapSelectedRegion
      ? rankedCandidates.find((candidate) => candidate.showLeader) ??
        rankedCandidates[0]
      : rankedCandidates[0];
  if (!chosen) return undefined;
  const leaderEndX = clamp(region.centroid.x, chosen.box.minX, chosen.box.maxX);
  const leaderEndY = clamp(region.centroid.y, chosen.box.minY, chosen.box.maxY);
  const dx = leaderEndX - region.centroid.x;
  const dy = leaderEndY - region.centroid.y;
  const leaderLength = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  return {
    regionId: region.id,
    lines,
    textAnchor: chosen.textAnchor,
    textX: chosen.textX,
    textY: chosen.box.textY,
    showLeader: chosen.showLeader,
    leaderEndX,
    leaderEndY,
    elbowX:
      chosen.textAnchor === "start"
        ? leaderEndX - 2.5 / zoomScale
        : chosen.textAnchor === "end"
          ? leaderEndX + 2.5 / zoomScale
          : leaderEndX,
    elbowY: leaderEndY,
    edgeX: region.centroid.x + (dx / leaderLength) * radius,
    edgeY: region.centroid.y + (dy / leaderLength) * radius,
    minX: chosen.box.minX,
    minY: chosen.box.minY,
    maxX: chosen.box.maxX,
    maxY: chosen.box.maxY,
    score: chosen.score,
  };
}

/** Three spots up and to the right of the circle, drawn with a leader. */
function buildExternalCandidates(
  region: UmapRegionItem,
  lines: string[],
  context: PlacementContext,
  isSelected: boolean,
): RegionLabelCandidate[] {
  const { zoomScale, labelFontSize, viewportBounds } = context;
  const radius = regionDrawRadius(region);
  const { labelWidth, labelHeight } = measureRegionLabel({
    lines,
    zoomScale,
    labelFontSize,
  });
  const preferredTop = isSelected
    ? region.centroid.y - radius * 0.98 - labelHeight * 0.96 - 12 / zoomScale
    : region.centroid.y - radius * 0.9 - labelHeight * 0.58 - 4 / zoomScale;
  const preferredLeft = isSelected
    ? region.centroid.x + radius * 0.62 + 20 / zoomScale
    : region.centroid.x + radius * 0.42 + 14 / zoomScale;
  const spots = [
    { left: preferredLeft, top: preferredTop },
    { left: preferredLeft + 8 / zoomScale, top: preferredTop - 6 / zoomScale },
    { left: preferredLeft - 6 / zoomScale, top: preferredTop + 8 / zoomScale },
  ];

  return spots.map((spot) => {
    let box = computeLabelBox({
      textAnchor: "start",
      textX: spot.left,
      topY: spot.top,
      labelWidth,
      labelHeight,
      labelFontSize,
    });
    let shiftDistance = 0;
    let offscreenPenalty = 0;
    if (viewportBounds) {
      const { shiftX, shiftY } = measureShiftIntoBounds(box, viewportBounds);
      shiftDistance = Math.abs(shiftX) + Math.abs(shiftY);
      offscreenPenalty =
        Math.max(0, viewportBounds.minX - box.minX) +
        Math.max(0, box.maxX - viewportBounds.maxX) +
        Math.max(0, viewportBounds.minY - box.minY) +
        Math.max(0, box.maxY - viewportBounds.maxY);
      box = shiftLabelBox(box, shiftX, shiftY);
    }
    const overlapPenalty = measureBoxOverlap(
      box,
      context.placed,
      context.labelSpacingX,
      context.labelSpacingY,
    );
    const contest = measureRegionBoxContest({
      box,
      regions: context.regions,
      regionId: region.id,
      zoomScale,
    });
    const contestedExternalPenalty =
      !isSelected && contest.otherOverlap > 0.25 ? 1_000_000 : 0;
    const score =
      overlapPenalty * 1600 +
      offscreenPenalty * 2200 +
      shiftDistance * 14 +
      contestedExternalPenalty +
      contest.otherOverlap * 120 +
      contest.selfOverlap * (isSelected ? 2 : 18) -
      (isSelected ? 320 : 0);
    return {
      showLeader: true,
      box,
      textAnchor: "start" as const,
      textX: box.minX,
      score,
    };
  });
}

/** Two spots inside the circle: upper right and centered, no leader. */
function buildInsideCandidates(
  region: UmapRegionItem,
  lines: string[],
  context: PlacementContext,
  flags: { isSelected: boolean; canOverlapSelectedRegion: boolean },
): RegionLabelCandidate[] {
  const { zoomScale, labelFontSize } = context;
  const radius = regionDrawRadius(region);
  const { labelWidth, labelHeight } = measureRegionLabel({
    lines,
    zoomScale,
    labelFontSize,
  });
  const insideTopRight = computeLabelBox({
    textAnchor: "start",
    textX: region.centroid.x + radius * 0.1,
    topY:
      region.centroid.y -
      Math.min(radius * 0.72, labelHeight * 0.7) -
      2 / zoomScale,
    labelWidth,
    labelHeight,
    labelFontSize,
  });
  const centeredInside = computeLabelBox({
    textAnchor: "middle",
    textX: region.centroid.x,
    topY: region.centroid.y - labelHeight / 2,
    labelWidth: Math.max(
      64 / zoomScale,
      Math.max(...lines.map((line) => line.length), 8) * labelFontSize * 0.42,
    ),
    labelHeight,
    labelFontSize,
  });
  const insidePenaltyBase = flags.canOverlapSelectedRegion
    ? 40
    : flags.isSelected
      ? 420
      : 140;

  return [insideTopRight, centeredInside].map((box) => {
    const overlapPenalty = measureBoxOverlap(
      box,
      context.placed,
      context.labelSpacingX,
      context.labelSpacingY,
    );
    const contest = measureRegionBoxContest({
      box,
      regions: context.regions,
      regionId: region.id,
      zoomScale,
    });
    const score =
      overlapPenalty * 1450 +
      contest.otherOverlap * 220 +
      contest.selfOverlap * (flags.canOverlapSelectedRegion ? 10 : 2) +
      insidePenaltyBase -
      radius * 0.12;
    return {
      showLeader: false,
      box,
      textAnchor:
        box === insideTopRight ? ("start" as const) : ("middle" as const),
      textX: box === insideTopRight ? box.minX : region.centroid.x,
      score,
    };
  });
}
