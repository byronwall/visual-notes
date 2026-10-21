import type { DocItem } from "~/types/notes";
import {
  clamp,
  computeLabelBox,
  measureBoxOverlap,
  shiftLabelBoxIntoBounds,
  smoothstep,
  wrapRegionTitle,
  type Bounds,
  type LabelTextAnchor,
  type Point,
} from "./label-geometry";

export type NoteLabelLayout = {
  docId: string;
  lines: string[];
  textAnchor: LabelTextAnchor;
  textX: number;
  textY: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  leaderStartX: number;
  leaderStartY: number;
  leaderEndX: number;
  leaderEndY: number;
};

type ScoredNoteLabelLayout = NoteLabelLayout & {
  score: number;
  /** Padded overlap with labels already placed; 0 when clear. */
  overlap: number;
};

type NotePlacementContext = {
  zoomScale: number;
  labelFontSize: number;
  inwardBias: number;
  radialSteps: number[];
  labelSpacingX: number;
  labelSpacingY: number;
  selectedRegion?: { centroid: Point; radius: number };
  viewportBounds?: Bounds;
  viewportCenter?: Point;
  placed: Bounds[];
};

const RESERVED_MIN_ANGLE = (-95 * Math.PI) / 180;
const RESERVED_MAX_ANGLE = (35 * Math.PI) / 180;
const ANGLE_OFFSETS = [0, -0.22, 0.22, -0.42, 0.42, -0.66, 0.66];

/**
 * Places note labels greedily in `labelOrder`. Each note tries a ring of
 * angles at several radial distances and keeps the lowest-penalty spot.
 * Inside a selected region, labels push outward from the region center and
 * skip the upper-right arc reserved for the region's own label.
 */
export function buildNoteLabelLayouts(args: {
  docs: DocItem[];
  positions: Map<string, Point>;
  labeledIds: Set<string>;
  labelOrder: string[];
  zoomScale: number;
  labelFontSize: number;
  selectedRegion?: { centroid: Point; radius: number };
  viewportBounds?: Bounds;
  occupiedBoxes?: Bounds[];
  /** Stop after this many labels are placed. */
  maxCount?: number;
  /** Drop a note whose best spot still overlaps a placed label. */
  skipOverlapping?: boolean;
}) {
  const docsById = new Map(args.docs.map((doc) => [doc.id, doc]));
  const selected = args.labelOrder
    .map((docId) => docsById.get(docId))
    .filter((doc): doc is DocItem => !!doc)
    .filter((doc) => args.labeledIds.has(doc.id));
  const inwardBias = smoothstep(1.15, 2.45, args.zoomScale);
  const context: NotePlacementContext = {
    zoomScale: args.zoomScale,
    labelFontSize: args.labelFontSize,
    inwardBias,
    radialSteps: [
      8 - inwardBias * 3,
      12 - inwardBias * 4,
      24 - inwardBias * 6,
      38 - inwardBias * 8,
    ].map((step) => Math.max(10, step) / args.zoomScale),
    labelSpacingX: 10 / args.zoomScale,
    labelSpacingY: 8 / args.zoomScale,
    selectedRegion: args.selectedRegion,
    viewportBounds: args.viewportBounds,
    viewportCenter: args.viewportBounds
      ? {
          x: (args.viewportBounds.minX + args.viewportBounds.maxX) / 2,
          y: (args.viewportBounds.minY + args.viewportBounds.maxY) / 2,
        }
      : undefined,
    placed: [...(args.occupiedBoxes ?? [])],
  };
  const layouts: NoteLabelLayout[] = [];

  const maxCount = args.maxCount ?? Number.POSITIVE_INFINITY;
  for (const doc of selected) {
    if (layouts.length >= maxCount) break;
    const pos = args.positions.get(doc.id);
    if (!pos) continue;
    const best = placeNoteLabel(doc, pos, context);
    if (!best) continue;
    if (args.skipOverlapping && best.overlap > 0) continue;
    context.placed.push({
      minX: best.minX - context.labelSpacingX,
      minY: best.minY - context.labelSpacingY,
      maxX: best.maxX + context.labelSpacingX,
      maxY: best.maxY + context.labelSpacingY,
    });
    const { score: _score, overlap: _overlap, ...layout } = best;
    layouts.push(layout);
  }

  return layouts;
}

function placeNoteLabel(
  doc: DocItem,
  pos: Point,
  context: NotePlacementContext,
): ScoredNoteLabelLayout | undefined {
  const { zoomScale, inwardBias, selectedRegion } = context;
  const lines = wrapRegionTitle(doc.title, 16, 2);
  const lineHeight = context.labelFontSize * 0.9;
  const labelWidth = Math.max(
    72 / zoomScale,
    Math.max(...lines.map((line) => line.length), 8) *
      context.labelFontSize *
      0.54 +
      10 / zoomScale,
  );
  const labelHeight = lines.length * lineHeight + 6 / zoomScale;
  let best: ScoredNoteLabelLayout | undefined;

  const regionCenter = selectedRegion?.centroid ?? pos;
  const rawAngle = Math.atan2(pos.y - regionCenter.y, pos.x - regionCenter.x);
  const baseAngle =
    rawAngle >= RESERVED_MIN_ANGLE && rawAngle <= RESERVED_MAX_ANGLE
      ? Math.abs(rawAngle - RESERVED_MIN_ANGLE) <
        Math.abs(RESERVED_MAX_ANGLE - rawAngle)
        ? RESERVED_MIN_ANGLE - 0.14
        : RESERVED_MAX_ANGLE + 0.14
      : rawAngle;
  const angleCandidates = ANGLE_OFFSETS.map((offset) => baseAngle + offset);
  const noteDistanceFromCenter = Math.hypot(
    pos.x - regionCenter.x,
    pos.y - regionCenter.y,
  );
  const perimeterBase = selectedRegion
    ? Math.max(
        selectedRegion.radius + (28 - inwardBias * 18) / zoomScale,
        noteDistanceFromCenter + (28 - inwardBias * 18) / zoomScale,
      )
    : 36 / zoomScale;
  const innerBase = selectedRegion
    ? Math.max(
        noteDistanceFromCenter + (10 - inwardBias * 4) / zoomScale,
        selectedRegion.radius * (0.2 + inwardBias * 0.24),
      )
    : 20 / zoomScale;
  const anchorBase = selectedRegion
    ? perimeterBase * (1 - inwardBias) + innerBase * inwardBias
    : perimeterBase;

  for (const radial of context.radialSteps) {
    for (const angle of angleCandidates) {
      const candidate = scoreNoteLabelCandidate({
        doc,
        pos,
        lines,
        labelWidth,
        labelHeight,
        regionCenter,
        angle,
        radial,
        anchorDistance: anchorBase + radial,
        context,
      });
      if (!best || candidate.score < best.score) best = candidate;
    }
  }
  return best;
}

function scoreNoteLabelCandidate(args: {
  doc: DocItem;
  pos: Point;
  lines: string[];
  labelWidth: number;
  labelHeight: number;
  regionCenter: Point;
  angle: number;
  radial: number;
  anchorDistance: number;
  context: NotePlacementContext;
}): ScoredNoteLabelLayout {
  const { pos, labelWidth, labelHeight, regionCenter, context } = args;
  const { zoomScale, inwardBias, viewportBounds, viewportCenter } = context;
  const cos = Math.cos(args.angle);
  const sin = Math.sin(args.angle);
  const anchorX = context.selectedRegion
    ? regionCenter.x + cos * args.anchorDistance
    : pos.x + cos * args.radial;
  const anchorY = context.selectedRegion
    ? regionCenter.y + sin * args.anchorDistance
    : pos.y + sin * args.radial;
  const textAnchor: LabelTextAnchor =
    cos > 0.32 ? "start" : cos < -0.32 ? "end" : "middle";
  let textX =
    textAnchor === "middle"
      ? anchorX
      : anchorX + Math.sign(cos || 1) * (8 / zoomScale);
  let boxMinX =
    textAnchor === "start"
      ? textX
      : textAnchor === "end"
        ? textX - labelWidth
        : textX - labelWidth / 2;
  let boxMaxX =
    textAnchor === "start"
      ? textX + labelWidth
      : textAnchor === "end"
        ? textX
        : textX + labelWidth / 2;
  let boxMinY =
    sin < -0.12
      ? anchorY - labelHeight
      : sin > 0.12
        ? anchorY
        : anchorY - labelHeight / 2;
  let boxMaxY = boxMinY + labelHeight;
  let offscreenPenalty = 0;

  if (viewportBounds) {
    const offLeft = Math.max(0, viewportBounds.minX - boxMinX);
    const offRight = Math.max(0, boxMaxX - viewportBounds.maxX);
    const offTop = Math.max(0, viewportBounds.minY - boxMinY);
    const offBottom = Math.max(0, boxMaxY - viewportBounds.maxY);
    offscreenPenalty = offLeft + offRight + offTop + offBottom;
    const shiftX =
      (boxMinX < viewportBounds.minX ? viewportBounds.minX - boxMinX : 0) +
      (boxMaxX > viewportBounds.maxX ? viewportBounds.maxX - boxMaxX : 0);
    const shiftY =
      (boxMinY < viewportBounds.minY ? viewportBounds.minY - boxMinY : 0) +
      (boxMaxY > viewportBounds.maxY ? viewportBounds.maxY - boxMaxY : 0);
    boxMinX += shiftX;
    boxMaxX += shiftX;
    boxMinY += shiftY;
    boxMaxY += shiftY;
    textX += shiftX;
  }

  const overlapPenalty = measureBoxOverlap(
    { minX: boxMinX, minY: boxMinY, maxX: boxMaxX, maxY: boxMaxY },
    context.placed,
    context.labelSpacingX,
    context.labelSpacingY,
  );
  const leaderEndX = clamp(pos.x, boxMinX, boxMaxX);
  const leaderEndY = clamp(pos.y, boxMinY, boxMaxY);
  const leaderLength = Math.hypot(leaderEndX - pos.x, leaderEndY - pos.y);
  const boxCenterX = (boxMinX + boxMaxX) / 2;
  const boxCenterY = (boxMinY + boxMaxY) / 2;
  const regionDistancePenalty =
    context.selectedRegion == null
      ? 0
      : Math.hypot(boxCenterX - regionCenter.x, boxCenterY - regionCenter.y) *
        (0.03 + inwardBias * 0.08);
  const viewportCenterPenalty =
    viewportCenter == null
      ? 0
      : Math.hypot(
          boxCenterX - viewportCenter.x,
          boxCenterY - viewportCenter.y,
        ) *
        inwardBias *
        0.09;
  const score =
    overlapPenalty * 1700 +
    offscreenPenalty * 2600 +
    leaderLength * (1.2 - inwardBias * 0.35) +
    regionDistancePenalty * 1.6 +
    viewportCenterPenalty * 1.8 +
    Math.abs((boxMinY + boxMaxY) / 2 - pos.y) * 0.04 +
    Math.max(0, 28 / zoomScale - args.anchorDistance) * 28;

  return {
    docId: args.doc.id,
    lines: args.lines,
    textAnchor,
    textX,
    textY: boxMinY + context.labelFontSize * 0.92,
    minX: boxMinX,
    minY: boxMinY,
    maxX: boxMaxX,
    maxY: boxMaxY,
    leaderStartX: pos.x,
    leaderStartY: pos.y,
    leaderEndX,
    leaderEndY,
    score,
    overlap: overlapPenalty,
  };
}

/** The hovered note's label: a bubble pinned above-right of its dot. */
export function buildAnchoredHoveredNoteLabelLayout(args: {
  doc: DocItem;
  position: Point;
  zoomScale: number;
  labelFontSize: number;
  viewportBounds?: Bounds;
}) {
  const lines = wrapRegionTitle(args.doc.title, 16, 2);
  const lineHeight = args.labelFontSize * 0.9;
  const labelWidth = Math.max(
    72 / args.zoomScale,
    Math.max(...lines.map((line) => line.length), 8) *
      args.labelFontSize *
      0.54 +
      12 / args.zoomScale,
  );
  const labelHeight = lines.length * lineHeight + 8 / args.zoomScale;
  const bubbleOffsetX = 10 / args.zoomScale;
  const bubbleOffsetY = 8 / args.zoomScale;
  const box = shiftLabelBoxIntoBounds(
    computeLabelBox({
      textAnchor: "start",
      textX: args.position.x + bubbleOffsetX,
      topY: args.position.y - labelHeight - bubbleOffsetY,
      labelWidth,
      labelHeight,
      labelFontSize: args.labelFontSize,
    }),
    args.viewportBounds,
  );

  return {
    docId: args.doc.id,
    lines,
    textAnchor: "start" as const,
    textX: box.minX,
    textY: box.textY,
    minX: box.minX,
    minY: box.minY,
    maxX: box.maxX,
    maxY: box.maxY,
    leaderStartX: args.position.x,
    leaderStartY: args.position.y,
    leaderEndX: box.minX + 8 / args.zoomScale,
    leaderEndY: box.maxY - 6 / args.zoomScale,
  } satisfies NoteLabelLayout;
}
