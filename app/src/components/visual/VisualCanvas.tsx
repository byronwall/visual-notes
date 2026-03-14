import {
  For,
  Show,
  createEffect,
  createMemo,
  onCleanup,
  createSignal,
  type Accessor,
  type VoidComponent,
} from "solid-js";
import { Box } from "styled-system/jsx";
import type { UmapRegionsSnapshot } from "~/features/umap/region-types";
import { colorFor } from "~/utils/colors";
import { seededPositionFor } from "~/layout/seeded";
import type { DocItem } from "~/types/notes";
import type { createSelectionStore } from "~/stores/selection.store";

type Point = { x: number; y: number };

type PanZoomHandlers = {
  onWheel: (e: WheelEvent) => void;
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onPointerLeave: () => void;
};

type RegionLabelLayout = {
  regionId: string;
  lines: string[];
  textAnchor: "start" | "middle" | "end";
  textX: number;
  textY: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  showLeader: boolean;
  leaderEndX: number;
  leaderEndY: number;
  elbowX: number;
  elbowY: number;
  edgeX: number;
  edgeY: number;
};

type NoteLabelLayout = {
  docId: string;
  lines: string[];
  textAnchor: "start" | "middle" | "end";
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

type CanvasPerfMetric = {
  count: number;
  total: number;
  max: number;
  last: number;
};

export type VisualCanvasProps = {
  docs: DocItem[] | undefined;
  positions: Accessor<Map<string, Point>>;
  umapRegions?: Accessor<UmapRegionsSnapshot | null>;
  viewportWidth?: Accessor<number>;
  viewportHeight?: Accessor<number>;
  hoveredId: Accessor<string | undefined>;
  railHoveredId?: Accessor<string | undefined>;
  onHoveredDocChange?: (id: string | undefined) => void;
  viewTransform: Accessor<string>;
  offset: Accessor<Point>;
  navHeight: Accessor<number>;
  scale?: Accessor<number>;
  searchQuery: Accessor<string>;
  eventHandlers: PanZoomHandlers;
  hoveredRegionId: Accessor<string | undefined>;
  onHoveredRegionChange: (id: string | undefined) => void;
  onPressedRegionChange: (id: string | undefined) => void;
  suppressNextOpen?: () => void;
  onSelectDoc: (id: string) => void;
  onZoomToRegion?: (id: string) => void;
  selectedRegionId?: Accessor<string | undefined>;
  regionsOnly?: Accessor<boolean>;
  selection?: ReturnType<typeof createSelectionStore>;
  // TODO:TYPE_MIRROR, allow extra props to avoid JSX excess property errors during incremental edits
  [key: string]: unknown;
};

const SPREAD = 1000;
const SELECTED_REGION_INSIDE_LABEL_ZOOM = 4.25;
const isBrowser = typeof window !== "undefined";

function trackCanvasPerf(name: string, duration: number) {
  if (!isBrowser || !Number.isFinite(duration)) return;
  const metricsHost = window as Window & {
    __canvasPerf?: Record<string, CanvasPerfMetric>;
  };
  const metrics = (metricsHost.__canvasPerf ??= {});
  const existing = metrics[name] ?? {
    count: 0,
    total: 0,
    max: 0,
    last: 0,
  };
  existing.count += 1;
  existing.total += duration;
  existing.max = Math.max(existing.max, duration);
  existing.last = duration;
  metrics[name] = existing;
}

function measureCanvasWork<T>(name: string, fn: () => T) {
  if (!isBrowser || typeof performance === "undefined") {
    return fn();
  }
  const start = performance.now();
  const result = fn();
  trackCanvasPerf(name, performance.now() - start);
  return result;
}

function smoothstep(edge0: number, edge1: number, value: number) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function truncateLabelText(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  if (maxChars <= 1) return "…";
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

function wrapRegionTitle(title: string, maxChars = 16, maxLines = 3) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [truncateLabelText(title, maxChars)];
  const lines: string[] = [];
  let current = "";
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!;
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (!current) {
      lines.push(truncateLabelText(word, maxChars));
      if (lines.length === maxLines) return lines;
      continue;
    }
    lines.push(current);
    if (lines.length === maxLines - 1) {
      const remainder = [word, ...words.slice(index + 1)].join(" ");
      lines.push(truncateLabelText(remainder, maxChars));
      return lines;
    }
    current = word;
  }
  if (current) {
    lines.push(truncateLabelText(current, maxChars));
  }
  return lines.slice(0, maxLines);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function computeLabelBox(args: {
  textAnchor: "start" | "middle" | "end";
  textX: number;
  topY: number;
  labelWidth: number;
  labelHeight: number;
  labelFontSize: number;
}) {
  const minX =
    args.textAnchor === "start"
      ? args.textX
      : args.textAnchor === "end"
        ? args.textX - args.labelWidth
        : args.textX - args.labelWidth / 2;
  return {
    minX,
    minY: args.topY,
    maxX: minX + args.labelWidth,
    maxY: args.topY + args.labelHeight,
    textY: args.topY + args.labelFontSize * 0.9,
  };
}

function snapWorldCoordinate(value: number, zoomScale: number, screenOffset: number) {
  const screenValue = value * zoomScale + screenOffset;
  const snappedScreenValue = Math.round(screenValue * 2) / 2;
  return (snappedScreenValue - screenOffset) / zoomScale;
}

function snapRegionLabelLayout<T extends {
  textAnchor: "start" | "middle" | "end";
  textX: number;
  textY: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  leaderEndX: number;
  leaderEndY: number;
  elbowX: number;
  elbowY: number;
  edgeX: number;
  edgeY: number;
}>(layout: T, args: { zoomScale: number; offset: Point }) {
  return {
    ...layout,
    textX: snapWorldCoordinate(layout.textX, args.zoomScale, args.offset.x),
    textY: snapWorldCoordinate(layout.textY, args.zoomScale, args.offset.y),
    minX: snapWorldCoordinate(layout.minX, args.zoomScale, args.offset.x),
    minY: snapWorldCoordinate(layout.minY, args.zoomScale, args.offset.y),
    maxX: snapWorldCoordinate(layout.maxX, args.zoomScale, args.offset.x),
    maxY: snapWorldCoordinate(layout.maxY, args.zoomScale, args.offset.y),
    leaderEndX: snapWorldCoordinate(
      layout.leaderEndX,
      args.zoomScale,
      args.offset.x
    ),
    leaderEndY: snapWorldCoordinate(
      layout.leaderEndY,
      args.zoomScale,
      args.offset.y
    ),
    elbowX: snapWorldCoordinate(layout.elbowX, args.zoomScale, args.offset.x),
    elbowY: snapWorldCoordinate(layout.elbowY, args.zoomScale, args.offset.y),
    edgeX: snapWorldCoordinate(layout.edgeX, args.zoomScale, args.offset.x),
    edgeY: snapWorldCoordinate(layout.edgeY, args.zoomScale, args.offset.y),
  };
}

function measureBoxOverlap(
  box: { minX: number; minY: number; maxX: number; maxY: number },
  placed: Array<{ minX: number; minY: number; maxX: number; maxY: number }>,
  spacingX: number,
  spacingY: number
) {
  return placed.reduce((penalty, placedBox) => {
    const overlapX = Math.max(
      0,
      Math.min(box.maxX + spacingX, placedBox.maxX) -
        Math.max(box.minX - spacingX, placedBox.minX)
    );
    const overlapY = Math.max(
      0,
      Math.min(box.maxY + spacingY, placedBox.maxY) -
        Math.max(box.minY - spacingY, placedBox.minY)
    );
    return penalty + overlapX * overlapY;
  }, 0);
}

function measureRegionBoxContest(args: {
  box: { minX: number; minY: number; maxX: number; maxY: number };
  regions: NonNullable<UmapRegionsSnapshot["regions"]>;
  regionId: string;
  zoomScale: number;
}) {
  let selfOverlap = 0;
  let otherOverlap = 0;
  for (const other of args.regions) {
    const pad = other.id === args.regionId ? 2 / args.zoomScale : 8 / args.zoomScale;
    const closestX = clamp(other.centroid.x, args.box.minX, args.box.maxX);
    const closestY = clamp(other.centroid.y, args.box.minY, args.box.maxY);
    const dx = other.centroid.x - closestX;
    const dy = other.centroid.y - closestY;
    const gap = Math.sqrt(dx * dx + dy * dy) - (Math.max(18, other.radius) + pad);
    if (gap < 0) {
      if (other.id === args.regionId) selfOverlap += gap * gap;
      else otherOverlap += gap * gap;
    }
  }
  return { selfOverlap, otherOverlap };
}

function buildStableRegionLabelOrder(
  regions: NonNullable<UmapRegionsSnapshot["regions"]>
) {
  if (regions.length <= 1) {
    return regions.map((region) => region.id);
  }

  const baseSorted = regions
    .slice()
    .sort(
      (a, b) =>
        b.docCount - a.docCount ||
        b.radius - a.radius ||
        a.title.localeCompare(b.title)
    );
  const maxDocCount = Math.max(...regions.map((region) => region.docCount), 1);
  const maxRadius = Math.max(...regions.map((region) => region.radius), 1);
  const center = regions.reduce(
    (acc, region) => ({
      x: acc.x + region.centroid.x,
      y: acc.y + region.centroid.y,
    }),
    { x: 0, y: 0 }
  );
  center.x /= regions.length;
  center.y /= regions.length;
  const maxCenterDistance = Math.max(
    ...regions.map((region) =>
      Math.hypot(region.centroid.x - center.x, region.centroid.y - center.y)
    ),
    1
  );

  const ordered = [baseSorted[0]];
  const remaining = new Map(baseSorted.slice(1).map((region) => [region.id, region]));

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
            region.centroid.y - selected.centroid.y
          )
        );
      }
      const gapScore = nearestDistance / SPREAD;
      const sizeScore =
        region.docCount / maxDocCount + region.radius / maxRadius;
      const centerDistance = Math.hypot(
        region.centroid.x - center.x,
        region.centroid.y - center.y
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

function getVisibleRegionLabelCount(args: {
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
    args.zoomScale
  );
  return Math.max(
    minCount,
    Math.min(maxCount, Math.round(minCount + (maxCount - minCount) * ratio))
  );
}

function buildRegionLabelLayouts(args: {
  regions: NonNullable<UmapRegionsSnapshot["regions"]>;
  labeledIds: Set<string>;
  labelOrder?: string[];
  emphasizedIds?: Set<string>;
  zoomScale: number;
  offset: Point;
  labelFontSize: number;
  allowRegionOverlap?: boolean;
  viewportBounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  occupiedBoxes?: Array<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }>;
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

  const placed = [...(args.occupiedBoxes ?? [])];
  const layouts: RegionLabelLayout[] = [];
  const labelSpacingX = 12 / args.zoomScale;
  const labelSpacingY = 9 / args.zoomScale;

  for (const region of selected) {
    const isSelected = args.emphasizedIds?.has(region.id) ?? false;
    const canOverlapSelectedRegion =
      isSelected && args.zoomScale >= SELECTED_REGION_INSIDE_LABEL_ZOOM;
    const lines = wrapRegionTitle(region.title, 16, 3);
    const radius = Math.max(18, region.radius);
    const lineHeight = args.labelFontSize * 0.86;
    const labelWidth = Math.max(
      70 / args.zoomScale,
      Math.max(...lines.map((line) => line.length), 8) *
        args.labelFontSize *
        0.42
    );
    const labelHeight = lines.length * lineHeight + 4 / args.zoomScale;
    let best:
      | (RegionLabelLayout & {
          minX: number;
          minY: number;
          maxX: number;
          maxY: number;
          score: number;
        })
      | undefined;
    if (isSelected && !canOverlapSelectedRegion) {
      let box = computeLabelBox({
        textAnchor: "start",
        textX: region.centroid.x + radius + 18 / args.zoomScale,
        topY: region.centroid.y - radius - labelHeight - 8 / args.zoomScale,
        labelWidth,
        labelHeight,
        labelFontSize: args.labelFontSize,
      });
      if (args.viewportBounds) {
        const shiftX =
          (box.minX < args.viewportBounds.minX
            ? args.viewportBounds.minX - box.minX
            : 0) +
          (box.maxX > args.viewportBounds.maxX
            ? args.viewportBounds.maxX - box.maxX
            : 0);
        const shiftY =
          (box.minY < args.viewportBounds.minY
            ? args.viewportBounds.minY - box.minY
            : 0) +
          (box.maxY > args.viewportBounds.maxY
            ? args.viewportBounds.maxY - box.maxY
            : 0);
        box = {
          ...box,
          minX: box.minX + shiftX,
          maxX: box.maxX + shiftX,
          minY: box.minY + shiftY,
          maxY: box.maxY + shiftY,
          textY: box.textY + shiftY,
        };
      }
      const leaderEndX = clamp(region.centroid.x, box.minX, box.maxX);
      const leaderEndY = clamp(region.centroid.y, box.minY, box.maxY);
      const dx = leaderEndX - region.centroid.x;
      const dy = leaderEndY - region.centroid.y;
      const leaderLength = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      best = {
        regionId: region.id,
        lines,
        textAnchor: "start",
        textX: box.minX,
        textY: box.textY,
        showLeader: true,
        leaderEndX,
        leaderEndY,
        elbowX: leaderEndX - 2.5 / args.zoomScale,
        elbowY: leaderEndY,
        edgeX: region.centroid.x + (dx / leaderLength) * radius,
        edgeY: region.centroid.y + (dy / leaderLength) * radius,
        minX: box.minX,
        minY: box.minY,
        maxX: box.maxX,
        maxY: box.maxY,
        score: 0,
      };
      const snappedBest = snapRegionLabelLayout(best, {
        zoomScale: args.zoomScale,
        offset: args.offset,
      });
      placed.push({
        minX: snappedBest.minX - labelSpacingX,
        minY: snappedBest.minY - labelSpacingY,
        maxX: snappedBest.maxX + labelSpacingX,
        maxY: snappedBest.maxY + labelSpacingY,
      });
      layouts.push(snappedBest);
      continue;
    }
    const preferredTop = isSelected
      ? region.centroid.y -
        radius * 0.98 -
        labelHeight * 0.96 -
        12 / args.zoomScale
      : region.centroid.y -
        radius * 0.9 -
        labelHeight * 0.58 -
        4 / args.zoomScale;
    const preferredLeft = isSelected
      ? region.centroid.x + radius * 0.62 + 20 / args.zoomScale
      : region.centroid.x + radius * 0.42 + 14 / args.zoomScale;
    const externalCandidates = [
      { left: preferredLeft, top: preferredTop },
      {
        left: preferredLeft + 8 / args.zoomScale,
        top: preferredTop - 6 / args.zoomScale,
      },
      {
        left: preferredLeft - 6 / args.zoomScale,
        top: preferredTop + 8 / args.zoomScale,
      },
    ];

    const insideTopRight = computeLabelBox({
      textAnchor: "start",
      textX: region.centroid.x + radius * 0.1,
      topY:
        region.centroid.y -
        Math.min(radius * 0.72, labelHeight * 0.7) -
        2 / args.zoomScale,
      labelWidth,
      labelHeight,
      labelFontSize: args.labelFontSize,
    });
    const centeredInside = computeLabelBox({
      textAnchor: "middle",
      textX: region.centroid.x,
      topY: region.centroid.y - labelHeight / 2,
      labelWidth: Math.max(
        64 / args.zoomScale,
        Math.max(...lines.map((line) => line.length), 8) *
          args.labelFontSize *
          0.42
      ),
      labelHeight,
      labelFontSize: args.labelFontSize,
    });

    const candidateLayouts: Array<{
      showLeader: boolean;
      box: ReturnType<typeof computeLabelBox>;
      textAnchor: "start" | "middle" | "end";
      textX: number;
      score: number;
    }> = [];

    for (const external of externalCandidates) {
      let box = computeLabelBox({
        textAnchor: "start",
        textX: external.left,
        topY: external.top,
        labelWidth,
        labelHeight,
        labelFontSize: args.labelFontSize,
      });
      let shiftDistance = 0;
      let offscreenPenalty = 0;

      if (args.viewportBounds) {
        const shiftX =
          (box.minX < args.viewportBounds.minX
            ? args.viewportBounds.minX - box.minX
            : 0) +
          (box.maxX > args.viewportBounds.maxX
            ? args.viewportBounds.maxX - box.maxX
            : 0);
        const shiftY =
          (box.minY < args.viewportBounds.minY
            ? args.viewportBounds.minY - box.minY
            : 0) +
          (box.maxY > args.viewportBounds.maxY
            ? args.viewportBounds.maxY - box.maxY
            : 0);
        shiftDistance = Math.abs(shiftX) + Math.abs(shiftY);
        offscreenPenalty =
          Math.max(0, args.viewportBounds.minX - box.minX) +
          Math.max(0, box.maxX - args.viewportBounds.maxX) +
          Math.max(0, args.viewportBounds.minY - box.minY) +
          Math.max(0, box.maxY - args.viewportBounds.maxY);
        box = {
          ...box,
          minX: box.minX + shiftX,
          maxX: box.maxX + shiftX,
          minY: box.minY + shiftY,
          maxY: box.maxY + shiftY,
          textY: box.textY + shiftY,
        };
      }

      const overlapPenalty = measureBoxOverlap(
        box,
        placed,
        labelSpacingX,
        labelSpacingY
      );
      const contest = measureRegionBoxContest({
        box,
        regions: args.regions,
        regionId: region.id,
        zoomScale: args.zoomScale,
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
      candidateLayouts.push({
        showLeader: true,
        box,
        textAnchor: "start",
        textX: box.minX,
        score,
      });
    }

    const insidePenaltyBase = canOverlapSelectedRegion ? 40 : isSelected ? 420 : 140;
    for (const box of [insideTopRight, centeredInside]) {
      const overlapPenalty = measureBoxOverlap(
        box,
        placed,
        labelSpacingX,
        labelSpacingY
      );
      const contest = measureRegionBoxContest({
        box,
        regions: args.regions,
        regionId: region.id,
        zoomScale: args.zoomScale,
      });
      const score =
        overlapPenalty * 1450 +
        contest.otherOverlap * 220 +
        contest.selfOverlap * (canOverlapSelectedRegion ? 10 : 2) +
        insidePenaltyBase -
        radius * 0.12;
      candidateLayouts.push({
        showLeader: false,
        box,
        textAnchor: box === insideTopRight ? "start" : "middle",
        textX: box === insideTopRight ? box.minX : region.centroid.x,
        score,
      });
    }

    const rankedCandidates = candidateLayouts.slice().sort((a, b) => a.score - b.score);
    const chosen =
      isSelected && !canOverlapSelectedRegion
        ? rankedCandidates.find((candidate) => candidate.showLeader) ??
          rankedCandidates[0]
        : rankedCandidates[0];
    if (!chosen) continue;
    const leaderEndX = clamp(region.centroid.x, chosen.box.minX, chosen.box.maxX);
    const leaderEndY = clamp(region.centroid.y, chosen.box.minY, chosen.box.maxY);
    const dx = leaderEndX - region.centroid.x;
    const dy = leaderEndY - region.centroid.y;
    const leaderLength = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    best = {
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
          ? leaderEndX - 2.5 / args.zoomScale
          : chosen.textAnchor === "end"
            ? leaderEndX + 2.5 / args.zoomScale
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

    if (!best) continue;
    const snappedBest = snapRegionLabelLayout(best, {
      zoomScale: args.zoomScale,
      offset: args.offset,
    });
    placed.push({
      minX: snappedBest.minX - labelSpacingX,
      minY: snappedBest.minY - labelSpacingY,
      maxX: snappedBest.maxX + labelSpacingX,
      maxY: snappedBest.maxY + labelSpacingY,
    });
    layouts.push(snappedBest);
  }

  return layouts;
}

function buildStableNoteLabelOrder(args: {
  docs: DocItem[];
  positions: Map<string, Point>;
  viewportBounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
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
        { x: 0, y: 0, count: 0 }
      );
  const centerPoint =
    "count" in center
      ? {
          x: center.count > 0 ? center.x / center.count : 0,
          y: center.count > 0 ? center.y / center.count : 0,
        }
      : center;

  const remaining = new Map(
    args.docs
      .map((doc) => {
        const pos = args.positions.get(doc.id);
        return pos ? [doc.id, { doc, pos }] : null;
      })
      .filter((entry): entry is [string, { doc: DocItem; pos: Point }] => !!entry)
  );
  if (remaining.size === 0) return [];

  let firstId: string | undefined;
  let firstDist = Number.NEGATIVE_INFINITY;
  for (const [docId, entry] of remaining) {
    const dist = Math.hypot(entry.pos.x - centerPoint.x, entry.pos.y - centerPoint.y);
    if (dist > firstDist) {
      firstDist = dist;
      firstId = docId;
    }
  }
  if (!firstId) return [];
  const ordered = [remaining.get(firstId)!];
  remaining.delete(firstId);

  while (remaining.size > 0) {
    let bestId: string | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const [docId, entry] of remaining) {
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const selected of ordered) {
        nearestDistance = Math.min(
          nearestDistance,
          Math.hypot(entry.pos.x - selected.pos.x, entry.pos.y - selected.pos.y)
        );
      }
      const centerDistance = Math.hypot(
        entry.pos.x - centerPoint.x,
        entry.pos.y - centerPoint.y
      );
      const titlePenalty = Math.max(0, entry.doc.title.length - 28) * 0.08;
      const score = nearestDistance + centerDistance * 0.22 - titlePenalty;
      if (score > bestScore) {
        bestScore = score;
        bestId = docId;
      }
    }
    if (!bestId) break;
    ordered.push(remaining.get(bestId)!);
    remaining.delete(bestId);
  }

  return ordered.map((entry) => entry.doc.id);
}

function getVisibleNoteLabelCount(args: { visibleCount: number; zoomScale: number }) {
  if (args.visibleCount <= 0) return 0;
  const minCount = Math.min(5, args.visibleCount);
  const maxCount = Math.min(13, args.visibleCount);
  if (minCount >= maxCount) return maxCount;
  const ratio = smoothstep(1.1, 2.35, args.zoomScale);
  return Math.max(
    minCount,
    Math.min(maxCount, Math.round(minCount + (maxCount - minCount) * ratio))
  );
}

function buildNoteLabelLayouts(args: {
  docs: DocItem[];
  positions: Map<string, Point>;
  labeledIds: Set<string>;
  labelOrder: string[];
  zoomScale: number;
  labelFontSize: number;
  selectedRegion?: {
    centroid: Point;
    radius: number;
  };
  viewportBounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  occupiedBoxes?: Array<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }>;
}) {
  const docsById = new Map(args.docs.map((doc) => [doc.id, doc]));
  const selected = args.labelOrder
    .map((docId) => docsById.get(docId))
    .filter((doc): doc is DocItem => !!doc)
    .filter((doc) => args.labeledIds.has(doc.id));
  const placed = [...(args.occupiedBoxes ?? [])];
  const layouts: NoteLabelLayout[] = [];
  const inwardBias = smoothstep(1.15, 2.45, args.zoomScale);
  const radialSteps = [
    8 - inwardBias * 3,
    12 - inwardBias * 4,
    24 - inwardBias * 6,
    38 - inwardBias * 8,
  ].map((step) => Math.max(10, step) / args.zoomScale);
  const labelSpacingX = 10 / args.zoomScale;
  const labelSpacingY = 8 / args.zoomScale;
  const reservedMinAngle = (-95 * Math.PI) / 180;
  const reservedMaxAngle = (35 * Math.PI) / 180;
  const viewportCenter = args.viewportBounds
    ? {
        x: (args.viewportBounds.minX + args.viewportBounds.maxX) / 2,
        y: (args.viewportBounds.minY + args.viewportBounds.maxY) / 2,
      }
    : undefined;

  for (const doc of selected) {
    const pos = args.positions.get(doc.id);
    if (!pos) continue;
    const lines = wrapRegionTitle(doc.title, 16, 2);
    const lineHeight = args.labelFontSize * 0.9;
    const labelWidth = Math.max(
      72 / args.zoomScale,
      Math.max(...lines.map((line) => line.length), 8) *
        args.labelFontSize *
        0.54 +
        10 / args.zoomScale
    );
    const labelHeight = lines.length * lineHeight + 6 / args.zoomScale;
    let best:
      | (NoteLabelLayout & {
          score: number;
        })
      | undefined;

    const regionCenter = args.selectedRegion?.centroid ?? pos;
    const rawAngle = Math.atan2(pos.y - regionCenter.y, pos.x - regionCenter.x);
    const baseAngle =
      rawAngle >= reservedMinAngle && rawAngle <= reservedMaxAngle
        ? Math.abs(rawAngle - reservedMinAngle) <
          Math.abs(reservedMaxAngle - rawAngle)
          ? reservedMinAngle - 0.14
          : reservedMaxAngle + 0.14
        : rawAngle;
    const angleCandidates = [0, -0.22, 0.22, -0.42, 0.42, -0.66, 0.66].map(
      (offset) => baseAngle + offset
    );
    const noteDistanceFromCenter = Math.hypot(
      pos.x - regionCenter.x,
      pos.y - regionCenter.y
    );
    const perimeterBase = args.selectedRegion
      ? Math.max(
          args.selectedRegion.radius + (28 - inwardBias * 18) / args.zoomScale,
          noteDistanceFromCenter + (28 - inwardBias * 18) / args.zoomScale
        )
      : 36 / args.zoomScale;
    const innerBase = args.selectedRegion
      ? Math.max(
          noteDistanceFromCenter + (10 - inwardBias * 4) / args.zoomScale,
          args.selectedRegion.radius * (0.2 + inwardBias * 0.24)
        )
      : 20 / args.zoomScale;
    const anchorBase = args.selectedRegion
      ? perimeterBase * (1 - inwardBias) + innerBase * inwardBias
      : perimeterBase;

    for (const radial of radialSteps) {
      for (const angle of angleCandidates) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const anchorDistance = anchorBase + radial;
        const anchorX = args.selectedRegion
          ? regionCenter.x + cos * anchorDistance
          : pos.x + cos * radial;
        const anchorY = args.selectedRegion
          ? regionCenter.y + sin * anchorDistance
          : pos.y + sin * radial;
        const textAnchor = (
          cos > 0.32 ? "start" : cos < -0.32 ? "end" : "middle"
        ) as "start" | "middle" | "end";
        let textX =
          textAnchor === "middle"
            ? anchorX
            : anchorX + Math.sign(cos || 1) * (8 / args.zoomScale);
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

        if (args.viewportBounds) {
          const offLeft = Math.max(0, args.viewportBounds.minX - boxMinX);
          const offRight = Math.max(0, boxMaxX - args.viewportBounds.maxX);
          const offTop = Math.max(0, args.viewportBounds.minY - boxMinY);
          const offBottom = Math.max(0, boxMaxY - args.viewportBounds.maxY);
          offscreenPenalty = offLeft + offRight + offTop + offBottom;
          const shiftX =
            (boxMinX < args.viewportBounds.minX
              ? args.viewportBounds.minX - boxMinX
              : 0) +
            (boxMaxX > args.viewportBounds.maxX
              ? args.viewportBounds.maxX - boxMaxX
              : 0);
          const shiftY =
            (boxMinY < args.viewportBounds.minY
              ? args.viewportBounds.minY - boxMinY
              : 0) +
            (boxMaxY > args.viewportBounds.maxY
              ? args.viewportBounds.maxY - boxMaxY
              : 0);
          boxMinX += shiftX;
          boxMaxX += shiftX;
          boxMinY += shiftY;
          boxMaxY += shiftY;
          textX += shiftX;
        }

        const overlapPenalty = placed.reduce((penalty, box) => {
          const overlapX = Math.max(
            0,
            Math.min(boxMaxX + labelSpacingX, box.maxX) -
              Math.max(boxMinX - labelSpacingX, box.minX)
          );
          const overlapY = Math.max(
            0,
            Math.min(boxMaxY + labelSpacingY, box.maxY) -
              Math.max(boxMinY - labelSpacingY, box.minY)
          );
          return penalty + overlapX * overlapY;
        }, 0);
        const leaderEndX = clamp(pos.x, boxMinX, boxMaxX);
        const leaderEndY = clamp(pos.y, boxMinY, boxMaxY);
        const leaderLength = Math.hypot(leaderEndX - pos.x, leaderEndY - pos.y);
        const boxCenterX = (boxMinX + boxMaxX) / 2;
        const boxCenterY = (boxMinY + boxMaxY) / 2;
        const regionDistancePenalty =
          args.selectedRegion == null
            ? 0
            : Math.hypot(boxCenterX - regionCenter.x, boxCenterY - regionCenter.y) *
              (0.03 + inwardBias * 0.08);
        const viewportCenterPenalty =
          viewportCenter == null
            ? 0
            : Math.hypot(boxCenterX - viewportCenter.x, boxCenterY - viewportCenter.y) *
              inwardBias *
              0.09;
        const score =
          overlapPenalty * 1700 +
          offscreenPenalty * 2600 +
          leaderLength * (1.2 - inwardBias * 0.35) +
          regionDistancePenalty * 1.6 +
          viewportCenterPenalty * 1.8 +
          Math.abs((boxMinY + boxMaxY) / 2 - pos.y) * 0.04 +
          Math.max(0, 28 / args.zoomScale - anchorDistance) * 28;

        if (!best || score < best.score) {
          best = {
            docId: doc.id,
            lines,
            textAnchor,
            textX,
            textY: boxMinY + args.labelFontSize * 0.92,
            minX: boxMinX,
            minY: boxMinY,
            maxX: boxMaxX,
            maxY: boxMaxY,
            leaderStartX: pos.x,
            leaderStartY: pos.y,
            leaderEndX,
            leaderEndY,
            score,
          };
        }
      }
    }

    if (!best) continue;
    placed.push({
      minX: best.minX - labelSpacingX,
      minY: best.minY - labelSpacingY,
      maxX: best.maxX + labelSpacingX,
      maxY: best.maxY + labelSpacingY,
    });
    layouts.push(best);
  }

  return layouts;
}

function buildAnchoredHoveredNoteLabelLayout(args: {
  doc: DocItem;
  position: Point;
  zoomScale: number;
  labelFontSize: number;
  viewportBounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}) {
  const lines = wrapRegionTitle(args.doc.title, 16, 2);
  const lineHeight = args.labelFontSize * 0.9;
  const labelWidth = Math.max(
    72 / args.zoomScale,
    Math.max(...lines.map((line) => line.length), 8) *
      args.labelFontSize *
      0.54 +
      12 / args.zoomScale
  );
  const labelHeight = lines.length * lineHeight + 8 / args.zoomScale;
  const bubbleOffsetX = 10 / args.zoomScale;
  const bubbleOffsetY = 8 / args.zoomScale;
  let box = computeLabelBox({
    textAnchor: "start",
    textX: args.position.x + bubbleOffsetX,
    topY: args.position.y - labelHeight - bubbleOffsetY,
    labelWidth,
    labelHeight,
    labelFontSize: args.labelFontSize,
  });

  if (args.viewportBounds) {
    const shiftX =
      (box.minX < args.viewportBounds.minX
        ? args.viewportBounds.minX - box.minX
        : 0) +
      (box.maxX > args.viewportBounds.maxX
        ? args.viewportBounds.maxX - box.maxX
        : 0);
    const shiftY =
      (box.minY < args.viewportBounds.minY
        ? args.viewportBounds.minY - box.minY
        : 0) +
      (box.maxY > args.viewportBounds.maxY
        ? args.viewportBounds.maxY - box.maxY
        : 0);
    box = {
      ...box,
      minX: box.minX + shiftX,
      maxX: box.maxX + shiftX,
      minY: box.minY + shiftY,
      maxY: box.maxY + shiftY,
      textY: box.textY + shiftY,
    };
  }

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

export const VisualCanvas: VoidComponent<VisualCanvasProps> = (props) => {
  const dotHoveredId = createMemo(() => props.hoveredId());
  const effectiveHoveredId = createMemo(
    () => props.railHoveredId?.() ?? dotHoveredId()
  );
  const [pointerOverNoteLabelId, setPointerOverNoteLabelId] = createSignal<
    string | undefined
  >(undefined);
  const [frozenHoveredNoteLabelLayout, setFrozenHoveredNoteLabelLayout] =
    createSignal<NoteLabelLayout | null>(null);
  let frozenHoveredNoteLabelClearTimer: ReturnType<typeof setTimeout> | undefined;
  const [pointerCanvasPosition, setPointerCanvasPosition] = createSignal<
    Point | undefined
  >();
  const viewportBounds = createMemo(() => {
    const width = props.viewportWidth?.() ?? 0;
    const height = props.viewportHeight?.() ?? 0;
    const scale = Math.max(0.001, props.scale?.() ?? 1);
    const offset = props.offset();
    if (width <= 0 || height <= 0) return undefined;
    const padding = 16 / scale;
    return {
      minX: (-offset.x + padding) / scale,
      minY: (-offset.y + padding) / scale,
      maxX: (width - offset.x - padding) / scale,
      maxY: (height - offset.y - padding) / scale,
    };
  });
  const handlePointerMove = (e: PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const scale = Math.max(0.001, props.scale?.() ?? 1);
    const offset = props.offset();
    setPointerCanvasPosition({
      x: (e.clientX - rect.left - offset.x) / scale,
      y: (e.clientY - rect.top - offset.y) / scale,
    });
    props.eventHandlers.onPointerMove(e);
  };
  const selectedRegionPointerInside = createMemo(() => {
    const selectedId = props.selectedRegionId?.();
    const pointer = pointerCanvasPosition();
    const regions = props.umapRegions?.()?.regions ?? [];
    if (!selectedId || !pointer) return false;
    const selectedRegion = regions.find((region) => region.id === selectedId);
    if (!selectedRegion) return false;
    return (
      Math.hypot(
        pointer.x - selectedRegion.centroid.x,
        pointer.y - selectedRegion.centroid.y
      ) <= Math.max(18, selectedRegion.radius)
    );
  });
  const isRegionHoverBlocked = (regionId: string) => {
    const selectedId = props.selectedRegionId?.();
    return (
      !!selectedId &&
      regionId !== selectedId &&
      selectedRegionPointerInside()
    );
  };

  createEffect(() => {
    const selectedId = props.selectedRegionId?.();
    const hoveredRegionId = props.hoveredRegionId();
    if (
      selectedId &&
      hoveredRegionId &&
      hoveredRegionId !== selectedId &&
      selectedRegionPointerInside()
    ) {
      props.onHoveredRegionChange(undefined);
    }
  });
  onCleanup(() => {
    if (frozenHoveredNoteLabelClearTimer) {
      clearTimeout(frozenHoveredNoteLabelClearTimer);
    }
  });

  return (
    <Box
      position="absolute"
      overflow="hidden"
      bg="bg.default"
      style={{
        left: "0",
        right: "0",
        bottom: "0",
        top: `${props.navHeight()}px`,
      }}
      onWheel={props.eventHandlers.onWheel}
      onPointerDown={props.eventHandlers.onPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={props.eventHandlers.onPointerUp}
      onPointerLeave={() => {
        setPointerCanvasPosition(undefined);
        setPointerOverNoteLabelId(undefined);
        setFrozenHoveredNoteLabelLayout(null);
        props.eventHandlers.onPointerLeave();
        props.onHoveredRegionChange(undefined);
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ display: "block", background: "white" }}
      >
        <g transform={props.viewTransform()}>
          <Show when={props.docs}>
            {(() => {
              const docsArr = createMemo(() => props.docs || []);
              const listOrdered = createMemo(() => docsArr());

              const circleRadius = createMemo(() => {
                const s = Math.max(0.001, props.scale?.() ?? 1);
                const screenRadius = Math.max(
                  3.6,
                  Math.min(6.2, 5.6 - smoothstep(1.2, 4.2, s) * 0.7)
                );
                return screenRadius / s;
              });

              const normalizedRegions = createMemo(
                () => props.umapRegions?.() ?? null
              );
              const zoomScale = createMemo(() =>
                Math.max(0.001, props.scale?.() ?? 1)
              );
              const [regionLabelDisplayZoom, setRegionLabelDisplayZoom] =
                createSignal(zoomScale());
              let regionLabelLullTimer: number | undefined;
              let regionLabelMaxTimer: number | undefined;
              let regionLabelBurstStartedAt = 0;

              const clearRegionLabelZoomTimers = () => {
                if (regionLabelLullTimer !== undefined) {
                  clearTimeout(regionLabelLullTimer);
                  regionLabelLullTimer = undefined;
                }
                if (regionLabelMaxTimer !== undefined) {
                  clearTimeout(regionLabelMaxTimer);
                  regionLabelMaxTimer = undefined;
                }
              };

              const commitRegionLabelDisplayZoom = (nextZoom: number) => {
                clearRegionLabelZoomTimers();
                regionLabelBurstStartedAt = 0;
                setRegionLabelDisplayZoom((current) =>
                  Math.abs(current - nextZoom) < 0.001 ? current : nextZoom
                );
              };

              createEffect(() => {
                const nextZoom = zoomScale();
                const currentDisplayZoom = regionLabelDisplayZoom();
                if (Math.abs(nextZoom - currentDisplayZoom) < 0.02) {
                  clearRegionLabelZoomTimers();
                  regionLabelBurstStartedAt = 0;
                  return;
                }

                const now =
                  typeof performance !== "undefined"
                    ? performance.now()
                    : Date.now();
                if (!regionLabelBurstStartedAt) {
                  regionLabelBurstStartedAt = now;
                }

                if (regionLabelLullTimer !== undefined) {
                  clearTimeout(regionLabelLullTimer);
                }
                regionLabelLullTimer = window.setTimeout(() => {
                  commitRegionLabelDisplayZoom(zoomScale());
                }, 120);

                if (regionLabelMaxTimer === undefined) {
                  const remaining = Math.max(
                    0,
                    280 - (now - regionLabelBurstStartedAt)
                  );
                  regionLabelMaxTimer = window.setTimeout(() => {
                    commitRegionLabelDisplayZoom(zoomScale());
                  }, remaining);
                }
              });

              onCleanup(() => {
                clearRegionLabelZoomTimers();
              });

              const regionLabelFontSize = createMemo(() => 16 / zoomScale());
              const noteLabelFontSize = createMemo(() => 12.5 / zoomScale());
              const regionOpacity = createMemo(() =>
                props.regionsOnly?.()
                  ? Math.max(0.65, 1 - smoothstep(0.4, 0.9, zoomScale()))
                  : Math.max(0.2, 1 - smoothstep(0.4, 0.9, zoomScale()))
              );
              const regionLabelOpacity = createMemo(() =>
                props.regionsOnly?.()
                  ? Math.max(0.88, 1 - smoothstep(0.45, 0.8, zoomScale()))
                  : Math.max(0.22, 1 - smoothstep(0.45, 0.8, zoomScale()))
              );
              const noteOpacity = createMemo(() => {
                if (props.regionsOnly?.()) return 0;
                if (!props.selectedRegionId?.()) return 0;
                return zoomScale() >= 0.96 ? 1 : 0;
              });
              const visibleDocsForRender = createMemo(() => {
                if (noteOpacity() <= 0.01) return [] as DocItem[];
                const bounds = viewportBounds();
                if (!bounds) return listOrdered();
                const overscan = Math.max(48, circleRadius() * 8);
                const minX = bounds.minX - overscan;
                const minY = bounds.minY - overscan;
                const maxX = bounds.maxX + overscan;
                const maxY = bounds.maxY + overscan;
                const positionMap = props.positions();
                const orderedDocs = listOrdered();
                return measureCanvasWork("visibleDocsForRender", () =>
                  orderedDocs.filter((doc, index) => {
                    const pos =
                      positionMap.get(doc.id) ??
                      seededPositionFor(doc.title, index, SPREAD);
                    return (
                      pos.x >= minX &&
                      pos.x <= maxX &&
                      pos.y >= minY &&
                      pos.y <= maxY
                    );
                  })
                );
              });
              const stableRegionLabelOrder = createMemo(() => {
                const regions = normalizedRegions()?.regions ?? [];
                return measureCanvasWork("stableRegionLabelOrder", () =>
                  buildStableRegionLabelOrder(regions)
                );
              });
              const visibleRegionLabelCount = createMemo(() =>
                getVisibleRegionLabelCount({
                  regionCount: normalizedRegions()?.regions.length ?? 0,
                  zoomScale: zoomScale(),
                  regionsOnly: props.regionsOnly?.() ?? false,
                })
              );
              const labeledRegionOrder = createMemo(() => {
                const selectedId = props.selectedRegionId?.();
                if (selectedId) return [selectedId];
                return stableRegionLabelOrder().slice(0, visibleRegionLabelCount());
              });
              const labeledRegionIds = createMemo(() => {
                const selectedId = props.selectedRegionId?.();
                if (selectedId) return new Set([selectedId]);
                const regions = normalizedRegions()?.regions ?? [];
                if (regions.length <= visibleRegionLabelCount()) {
                  return new Set(regions.map((region) => region.id));
                }
                return new Set(labeledRegionOrder());
              });
              const regionLabelLayouts = createMemo(() => {
                const regions = normalizedRegions()?.regions ?? [];
                const selectedId = props.selectedRegionId?.();
                const emphasizedIds = selectedId
                  ? new Set([selectedId])
                  : undefined;
                const labelIds = labeledRegionIds();
                const labelOrder = labeledRegionOrder();
                const currentZoomScale = zoomScale();
                const labelFontSize = regionLabelFontSize();
                const currentViewportBounds = viewportBounds();
                return measureCanvasWork("baseRegionLabelLayouts", () =>
                  buildRegionLabelLayouts({
                    regions,
                    labeledIds: labelIds,
                    labelOrder,
                    emphasizedIds,
                    zoomScale: currentZoomScale,
                    offset: props.offset(),
                    labelFontSize,
                    allowRegionOverlap: false,
                    viewportBounds: currentViewportBounds,
                  })
                );
              });
              const hoveredRegionLayout = createMemo(() => {
                const hoveredId = props.hoveredRegionId();
                if (!hoveredId || labeledRegionIds().has(hoveredId)) return null;
                const regions = normalizedRegions()?.regions ?? [];
                const occupiedBoxes = regionLabelLayouts().map((item) => ({
                  minX: item.minX,
                  minY: item.minY,
                  maxX: item.maxX,
                  maxY: item.maxY,
                }));
                const currentZoomScale = zoomScale();
                const labelFontSize = regionLabelFontSize();
                const currentViewportBounds = viewportBounds();
                const layout = measureCanvasWork("hoveredRegionLabelLayout", () =>
                  buildRegionLabelLayouts({
                    regions,
                    labeledIds: new Set([hoveredId]),
                    labelOrder: [hoveredId],
                    emphasizedIds: new Set([hoveredId]),
                    zoomScale: currentZoomScale,
                    offset: props.offset(),
                    labelFontSize,
                    allowRegionOverlap: false,
                    viewportBounds: currentViewportBounds,
                    occupiedBoxes,
                  })[0]
                );
                return layout ?? null;
              });
              const regionLabelLayoutById = createMemo(
                () =>
                  new Map(
                    [...regionLabelLayouts(), ...(hoveredRegionLayout() ? [hoveredRegionLayout()!] : [])].map(
                      (layout) => [layout.regionId, layout]
                    )
                  )
              );
              const fixedSelectedRegionLayout = createMemo(() => {
                const selectedId = props.selectedRegionId?.();
                if (
                  !selectedId ||
                  zoomScale() >= SELECTED_REGION_INSIDE_LABEL_ZOOM
                ) {
                  return null;
                }
                const region = (normalizedRegions()?.regions ?? []).find(
                  (item) => item.id === selectedId
                );
                if (!region) return null;
                const lines = wrapRegionTitle(region.title, 16, 3);
                const labelFontSize = regionLabelFontSize();
                const lineHeight = labelFontSize * 0.86;
                const labelWidth = Math.max(
                  70 / zoomScale(),
                  Math.max(...lines.map((line) => line.length), 8) *
                    labelFontSize *
                    0.42
                );
                const labelHeight = lines.length * lineHeight + 4 / zoomScale();
                let box = computeLabelBox({
                  textAnchor: "start",
                  textX:
                    region.centroid.x +
                    Math.max(18, region.radius) * 0.62 +
                    20 / zoomScale(),
                  topY:
                    region.centroid.y -
                    Math.max(18, region.radius) * 0.98 -
                    labelHeight * 0.96 -
                    12 / zoomScale(),
                  labelWidth,
                  labelHeight,
                  labelFontSize,
                });
                const bounds = viewportBounds();
                if (bounds) {
                  const shiftX =
                    (box.minX < bounds.minX ? bounds.minX - box.minX : 0) +
                    (box.maxX > bounds.maxX ? bounds.maxX - box.maxX : 0);
                  const shiftY =
                    (box.minY < bounds.minY ? bounds.minY - box.minY : 0) +
                    (box.maxY > bounds.maxY ? bounds.maxY - box.maxY : 0);
                  box = {
                    ...box,
                    minX: box.minX + shiftX,
                    maxX: box.maxX + shiftX,
                    minY: box.minY + shiftY,
                    maxY: box.maxY + shiftY,
                    textY: box.textY + shiftY,
                  };
                }
                const leaderEndX = clamp(region.centroid.x, box.minX, box.maxX);
                const leaderEndY = clamp(region.centroid.y, box.minY, box.maxY);
                const dx = leaderEndX - region.centroid.x;
                const dy = leaderEndY - region.centroid.y;
                const leaderLength = Math.max(1, Math.hypot(dx, dy));
                const radius = Math.max(18, region.radius);
                return snapRegionLabelLayout({
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
                  elbowX: leaderEndX - 2.5 / zoomScale(),
                  elbowY: leaderEndY,
                  edgeX: region.centroid.x + (dx / leaderLength) * radius,
                  edgeY: region.centroid.y + (dy / leaderLength) * radius,
                } satisfies RegionLabelLayout, {
                  zoomScale: zoomScale(),
                  offset: props.offset(),
                });
              });
              const visibleNoteLabelCount = createMemo(() =>
                props.selectedRegionId?.()
                  ? getVisibleNoteLabelCount({
                      visibleCount: visibleDocsForRender().length,
                      zoomScale: zoomScale(),
                    })
                  : 0
              );
              const visibleDocMap = createMemo(
                () => new Map(visibleDocsForRender().map((doc) => [doc.id, doc]))
              );
              const anchoredHoveredNoteLabelLayout = createMemo(() => {
                const selectedRegionId = props.selectedRegionId?.();
                const hoveredDocId = dotHoveredId();
                if (!selectedRegionId || !hoveredDocId) return null;
                const doc = visibleDocMap().get(hoveredDocId);
                if (!doc) return null;
                const docsForLabels = visibleDocsForRender();
                const docIndex = docsForLabels.findIndex(
                  (item) => item.id === hoveredDocId
                );
                if (docIndex < 0) return null;
                const position =
                  props.positions().get(hoveredDocId) ??
                  seededPositionFor(doc.title, docIndex, SPREAD);
                return buildAnchoredHoveredNoteLabelLayout({
                  doc,
                  position,
                  zoomScale: zoomScale(),
                  labelFontSize: noteLabelFontSize(),
                  viewportBounds: viewportBounds(),
                });
              });
              createEffect(() => {
                const anchoredLayout = anchoredHoveredNoteLabelLayout();
                if (anchoredLayout) {
                  if (frozenHoveredNoteLabelClearTimer) {
                    clearTimeout(frozenHoveredNoteLabelClearTimer);
                    frozenHoveredNoteLabelClearTimer = undefined;
                  }
                  setFrozenHoveredNoteLabelLayout(anchoredLayout);
                  return;
                }
                const pointerLabelId = pointerOverNoteLabelId();
                const frozenLayout = frozenHoveredNoteLabelLayout();
                if (pointerLabelId && frozenLayout?.docId === pointerLabelId) {
                  if (frozenHoveredNoteLabelClearTimer) {
                    clearTimeout(frozenHoveredNoteLabelClearTimer);
                    frozenHoveredNoteLabelClearTimer = undefined;
                  }
                  return;
                }
                if (frozenHoveredNoteLabelClearTimer) {
                  clearTimeout(frozenHoveredNoteLabelClearTimer);
                  frozenHoveredNoteLabelClearTimer = undefined;
                }
                if (!frozenLayout) return;
                const frozenDocId = frozenLayout.docId;
                frozenHoveredNoteLabelClearTimer = setTimeout(() => {
                  setFrozenHoveredNoteLabelLayout((current) =>
                    current && !pointerOverNoteLabelId() && current.docId === frozenDocId
                      ? null
                      : current
                  );
                  frozenHoveredNoteLabelClearTimer = undefined;
                }, 140);
              });
              const activeAnchoredNoteLabelLayout = createMemo(() => {
                const anchoredLayout = anchoredHoveredNoteLabelLayout();
                if (anchoredLayout) return anchoredLayout;
                const pointerLabelId = pointerOverNoteLabelId();
                const frozenLayout = frozenHoveredNoteLabelLayout();
                if (pointerLabelId && frozenLayout?.docId === pointerLabelId) {
                  return frozenLayout;
                }
                return null;
              });
              const visibleNoteLabelOrder = createMemo(() => {
                if (!props.selectedRegionId?.()) return [] as string[];
                const docsForLabels = visibleDocsForRender();
                const orderedIds = buildStableNoteLabelOrder({
                  docs: docsForLabels,
                  positions: props.positions(),
                  viewportBounds: viewportBounds(),
                });
                const anchoredDocId = activeAnchoredNoteLabelLayout()?.docId;
                return orderedIds
                  .filter((docId) => docId !== anchoredDocId)
                  .slice(0, visibleNoteLabelCount());
              });
              const visibleNoteLabelLayouts = createMemo(() => {
                const selectedRegionId = props.selectedRegionId?.();
                if (!selectedRegionId) return [] as NoteLabelLayout[];
                const occupiedBoxes = regionLabelLayouts().map((item) => ({
                  minX: item.minX,
                  minY: item.minY,
                  maxX: item.maxX,
                  maxY: item.maxY,
                }));
                const anchoredLayout = activeAnchoredNoteLabelLayout();
                if (anchoredLayout) {
                  occupiedBoxes.push({
                    minX: anchoredLayout.minX,
                    minY: anchoredLayout.minY,
                    maxX: anchoredLayout.maxX,
                    maxY: anchoredLayout.maxY,
                  });
                }
                const selectedRegion = (normalizedRegions()?.regions ?? []).find(
                  (region) => region.id === selectedRegionId
                );
                const layouts = buildNoteLabelLayouts({
                  docs: visibleDocsForRender(),
                  positions: props.positions(),
                  labeledIds: new Set(visibleNoteLabelOrder()),
                  labelOrder: visibleNoteLabelOrder(),
                  zoomScale: zoomScale(),
                  labelFontSize: noteLabelFontSize(),
                  selectedRegion: selectedRegion
                    ? {
                        centroid: selectedRegion.centroid,
                        radius: Math.max(18, selectedRegion.radius),
                      }
                    : undefined,
                  viewportBounds: viewportBounds(),
                  occupiedBoxes,
                });
                return anchoredLayout ? [anchoredLayout, ...layouts] : layouts;
              });
              const labelRenderOrder = createMemo(() => {
                const hoveredId = props.hoveredRegionId();
                const selectedId = props.selectedRegionId?.();
                return (normalizedRegions()?.regions ?? []).slice().sort((a, b) => {
                  if (a.id === selectedId) return 1;
                  if (b.id === selectedId) return -1;
                  if (a.id === hoveredId) return 1;
                  if (b.id === hoveredId) return -1;
                  return 0;
                });
              });

              return (
                <>
                  <defs>
                    <filter
                      id="canvas-hover-note-shadow"
                      x="-150%"
                      y="-150%"
                      width="400%"
                      height="400%"
                    >
                      <feDropShadow
                        dx="0"
                        dy="6"
                        stdDeviation="8"
                        flood-color="rgba(15, 23, 42, 0.28)"
                      />
                    </filter>
                  </defs>
                  <Show when={normalizedRegions()}>
                    {(regions) => (
                      <For each={regions().regions}>
                        {(region) => (
                          <circle
                            cx={region.centroid.x}
                            cy={region.centroid.y}
                            r={Math.max(18, region.radius)}
                            fill="transparent"
                            stroke="none"
                            style={{
                              "pointer-events": "none",
                            }}
                          />
                        )}
                      </For>
                    )}
                  </Show>
                  <Show when={regionOpacity() > 0.02}>
                    <Show when={normalizedRegions()}>
                      {(regions) => {
                        regions();
                        return (
                        <>
                          <For each={labelRenderOrder()}>
                            {(region) => (
                              <g>
                                <circle
                                  cx={region.centroid.x}
                                  cy={region.centroid.y}
                                  r={Math.max(18, region.radius)}
                                  fill={
                                    props.selectedRegionId?.() === region.id
                                      ? "rgba(37, 99, 235, 0.2)"
                                      : props.hoveredRegionId() === region.id
                                      ? "rgba(249, 115, 22, 0.12)"
                                      : "rgba(37, 99, 235, 0.06)"
                                  }
                                  stroke={
                                    props.selectedRegionId?.() === region.id
                                      ? "rgba(30, 64, 175, 0.9)"
                                      : props.hoveredRegionId() === region.id
                                      ? "rgba(234, 88, 12, 0.72)"
                                      : "rgba(37, 99, 235, 0.2)"
                                  }
                                  stroke-width={
                                    props.selectedRegionId?.() === region.id
                                      ? "3"
                                      : props.hoveredRegionId() === region.id
                                      ? "2.5"
                                      : "1.5"
                                  }
                                  vector-effect="non-scaling-stroke"
                                  opacity={
                                    props.selectedRegionId?.() === region.id
                                      ? Math.max(0.55, regionOpacity())
                                      : props.hoveredRegionId() === region.id
                                      ? Math.max(0.4, regionOpacity())
                                      : regionOpacity()
                                  }
                                  style={{
                                    cursor: "pointer",
                                    "pointer-events": isRegionHoverBlocked(region.id)
                                      ? "none"
                                      : "auto",
                                  }}
                                  onPointerEnter={() => {
                                    if (isRegionHoverBlocked(region.id)) return;
                                    props.onHoveredRegionChange(region.id);
                                  }}
                                  onPointerLeave={() => {
                                    if (isRegionHoverBlocked(region.id)) return;
                                    props.onHoveredRegionChange(undefined);
                                  }}
                                  onPointerDown={() => {
                                    if (isRegionHoverBlocked(region.id)) return;
                                    props.onHoveredRegionChange(region.id);
                                    props.onPressedRegionChange(region.id);
                                    props.suppressNextOpen?.();
                                  }}
                                  onClick={(e) => {
                                    if (isRegionHoverBlocked(region.id)) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    props.onZoomToRegion?.(region.id);
                                  }}
                                />
                                <Show
                                  when={
                                    props.selectedRegionId?.() === region.id ||
                                    props.hoveredRegionId() === region.id ||
                                    regionLabelOpacity() > 0.04
                                  }
                                >
                                  <Show
                                    when={
                                      props.selectedRegionId?.() === region.id ||
                                      props.hoveredRegionId() === region.id ||
                                      (props.selectedRegionId?.() == null &&
                                        labeledRegionIds().has(region.id))
                                    }
                                  >
                                    <Show
                                      when={
                                        (props.selectedRegionId?.() === region.id &&
                                          fixedSelectedRegionLayout()) ||
                                        regionLabelLayoutById().get(region.id)
                                      }
                                    >
                                      {(layout) => {
                                        const isHovered =
                                          props.hoveredRegionId() === region.id;
                                        const isSelected =
                                          props.selectedRegionId?.() === region.id;
                                        const currentZoomScale =
                                          regionLabelDisplayZoom();
                                        const inverseLabelScale =
                                          1 / currentZoomScale;
                                        const toLocalX = (value: number) =>
                                          (value - layout().minX) * currentZoomScale;
                                        const toLocalY = (value: number) =>
                                          (value - layout().minY) * currentZoomScale;
                                        const padX = 6;
                                        const padY = 4;
                                        const originX = layout().minX;
                                        const originY = layout().minY;
                                        return (
                                          <g
                                            opacity={
                                              isSelected
                                                ? 1
                                                : isHovered
                                                ? Math.max(0.95, regionLabelOpacity())
                                                : regionLabelOpacity()
                                            }
                                            style={{
                                              cursor: "pointer",
                                              "pointer-events":
                                                isRegionHoverBlocked(region.id)
                                                  ? "none"
                                                  : "auto",
                                              transform: `translate(${originX}px, ${originY}px) scale(${inverseLabelScale})`,
                                              "transform-origin": "0 0",
                                            }}
                                            onPointerDown={() => {
                                              props.onPressedRegionChange(region.id);
                                              props.suppressNextOpen?.();
                                            }}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              props.onZoomToRegion?.(region.id);
                                            }}
                                          >
                                            <rect
                                              x={-padX}
                                              y={-padY}
                                              width={
                                                (layout().maxX - layout().minX) *
                                                  currentZoomScale +
                                                padX * 2
                                              }
                                              height={
                                                (layout().maxY - layout().minY) *
                                                  currentZoomScale +
                                                padY * 2
                                              }
                                              rx={8}
                                              ry={8}
                                              fill="transparent"
                                              onPointerDown={() => {
                                                props.onPressedRegionChange(region.id);
                                                props.suppressNextOpen?.();
                                              }}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                props.onZoomToRegion?.(region.id);
                                              }}
                                            />
                                            <Show when={layout().showLeader}>
                                              <path
                                                d={`M ${toLocalX(layout().edgeX)} ${toLocalY(layout().edgeY)} L ${toLocalX(layout().elbowX)} ${toLocalY(layout().elbowY)} L ${toLocalX(layout().leaderEndX)} ${toLocalY(layout().leaderEndY)}`}
                                                fill="none"
                                                stroke={
                                                  isSelected
                                                    ? "rgba(30, 64, 175, 0.72)"
                                                    : isHovered
                                                    ? "rgba(30, 64, 175, 0.5)"
                                                    : "rgba(37, 99, 235, 0.3)"
                                                }
                                                stroke-width={
                                                  isSelected
                                                    ? "1.9"
                                                    : isHovered
                                                      ? "1.6"
                                                      : "1.25"
                                                }
                                                vector-effect="non-scaling-stroke"
                                                onPointerDown={() => {
                                                  props.onPressedRegionChange(region.id);
                                                  props.suppressNextOpen?.();
                                                }}
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  props.onZoomToRegion?.(region.id);
                                                }}
                                              />
                                            </Show>
                                            <text
                                              x={toLocalX(layout().textX)}
                                              y={toLocalY(layout().textY)}
                                              fill={
                                                isSelected || isHovered
                                                  ? "#0f172a"
                                                  : "#172554"
                                              }
                                              font-size="16"
                                              font-weight="700"
                                              text-anchor={layout().textAnchor}
                                              paint-order="stroke"
                                              stroke={
                                                isSelected
                                                  ? "rgba(219, 234, 254, 0.98)"
                                                  : isHovered
                                                  ? "rgba(255, 237, 213, 0.98)"
                                                  : "rgba(255,255,255,0.88)"
                                              }
                                              stroke-width={String(
                                                isSelected
                                                  ? 7
                                                  : isHovered
                                                  ? 6
                                                  : 4
                                              )}
                                              stroke-linejoin="round"
                                              onPointerDown={() => {
                                                props.onPressedRegionChange(region.id);
                                                props.suppressNextOpen?.();
                                              }}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                props.onZoomToRegion?.(region.id);
                                              }}
                                            >
                                              <For each={layout().lines}>
                                                {(line, lineIndex) => (
                                                  <tspan
                                                    x={toLocalX(layout().textX)}
                                                    dy={
                                                      lineIndex() === 0
                                                        ? "0"
                                                        : "15.2"
                                                    }
                                                    onPointerDown={() => {
                                                      props.onPressedRegionChange(
                                                        region.id
                                                      );
                                                      props.suppressNextOpen?.();
                                                    }}
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      props.onZoomToRegion?.(region.id);
                                                    }}
                                                  >
                                                    {line}
                                                  </tspan>
                                                )}
                                              </For>
                                            </text>
                                          </g>
                                        );
                                      }}
                                    </Show>
                                  </Show>
                                </Show>
                              </g>
                            )}
                          </For>
                        </>
                        );
                      }}
                    </Show>
                  </Show>
                  <Show when={noteOpacity() > 0.01}>
                    <For each={visibleDocsForRender()}>
                      {(d, i) => {
                        const pos = createMemo(
                          () =>
                            props.positions().get(d.id) ??
                            seededPositionFor(d.title, i(), SPREAD)
                        );
                        const fill = createMemo(() =>
                          colorFor(d.path || d.title)
                        );
                        const matchesSearch = createMemo(() => {
                          const q = props.searchQuery().trim().toLowerCase();
                          if (!q) return true;
                          return d.title.toLowerCase().includes(q);
                        });
                        const dimmed = createMemo(
                          () => !!props.searchQuery().trim() && !matchesSearch()
                        );
                        const isHovered = createMemo(
                          () => effectiveHoveredId() === d.id
                        );
                        return (
                          <Show when={matchesSearch() && !isHovered()}>
                            <g>
                              <circle
                                cx={pos().x}
                                cy={pos().y}
                                r={circleRadius()}
                                fill={dimmed() ? "#9CA3AF" : fill()}
                                stroke={
                                  dimmed() ? "#00000010" : "#00000020"
                                }
                                stroke-width={1}
                                vector-effect="non-scaling-stroke"
                                opacity={noteOpacity()}
                                style={{
                                  cursor: "pointer",
                                  "pointer-events":
                                    noteOpacity() > 0.08 ? "auto" : "none",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  props.onSelectDoc(d.id);
                                }}
                              />
                            </g>
                          </Show>
                        );
                      }}
                    </For>
                  </Show>
                  <Show when={visibleNoteLabelLayouts().length > 0}>
                    <For each={visibleNoteLabelLayouts()}>
                      {(layout) => {
                        const doc = createMemo(() => visibleDocMap().get(layout.docId));
                        const isHovered = createMemo(
                          () => effectiveHoveredId() === layout.docId
                        );
                        const clipId = `note-label-clip-${layout.docId}`;
                        const accentColor = createMemo(
                          () => colorFor(doc()?.path || doc()?.title || layout.docId)
                        );
                        const bubbleStroke = createMemo(() =>
                          isHovered()
                            ? "rgba(37, 99, 235, 0.3)"
                            : "rgba(148, 163, 184, 0.28)"
                        );
                        const leaderStroke = createMemo(() =>
                          isHovered()
                            ? "rgba(37, 99, 235, 0.5)"
                            : "rgba(100, 116, 139, 0.42)"
                        );
                        const originX = layout.minX;
                        const originY = layout.minY;
                        const hitPadX = 5 / zoomScale();
                        const hitPadY = 4 / zoomScale();
                        const bubbleWidth = layout.maxX - layout.minX;
                        const bubbleHeight = layout.maxY - layout.minY;
                        const bubbleRadius = 2.5 / zoomScale();
                        const textInsetX = 4 / zoomScale();
                        const renderedTextX =
                          layout.textAnchor === "start"
                            ? layout.textX - originX + textInsetX
                            : layout.textAnchor === "end"
                              ? layout.textX - originX - textInsetX
                              : layout.textX - originX;
                        return (
                          <g
                            style={{
                              "pointer-events": "none",
                              transform: `translate(${originX}px, ${originY}px)`,
                              "transform-origin": "0 0",
                              cursor: "pointer",
                            }}
                          >
                            <defs>
                              <clipPath id={clipId}>
                                <rect
                                  x={0.5 / zoomScale()}
                                  y={0.5 / zoomScale()}
                                  width={Math.max(0, bubbleWidth - 1 / zoomScale())}
                                  height={Math.max(0, bubbleHeight - 1 / zoomScale())}
                                  rx={bubbleRadius}
                                  ry={bubbleRadius}
                                />
                              </clipPath>
                            </defs>
                            <rect
                              x={-hitPadX}
                              y={-hitPadY}
                              width={bubbleWidth + hitPadX * 2}
                              height={bubbleHeight + hitPadY * 2}
                              rx={bubbleRadius + 1 / zoomScale()}
                              ry={bubbleRadius + 1 / zoomScale()}
                              fill="rgba(255,255,255,0.001)"
                              stroke="transparent"
                              stroke-width="1"
                              vector-effect="non-scaling-stroke"
                              style={{
                                cursor: "pointer",
                                "pointer-events":
                                  noteOpacity() > 0.08 ? "auto" : "none",
                              }}
                              onPointerEnter={() => {
                                setPointerOverNoteLabelId(layout.docId);
                                props.onHoveredDocChange?.(layout.docId)
                              }}
                              onPointerLeave={() => {
                                setPointerOverNoteLabelId(undefined);
                                props.onHoveredDocChange?.(undefined)
                              }}
                              onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                props.suppressNextOpen?.();
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                props.onSelectDoc(layout.docId);
                              }}
                            />
                            <rect
                              x={0}
                              y={0}
                              width={bubbleWidth}
                              height={bubbleHeight}
                              rx={bubbleRadius}
                              ry={bubbleRadius}
                              fill="rgba(255,255,255,0.94)"
                              stroke={bubbleStroke()}
                              stroke-width={isHovered() ? "1" : "0.85"}
                              vector-effect="non-scaling-stroke"
                              style={{ "pointer-events": "none" }}
                            />
                            <text
                              x={renderedTextX}
                              y={layout.textY - originY}
                              clip-path={`url(#${clipId})`}
                              fill={
                                isHovered()
                                  ? accentColor()
                                  : "rgba(15, 23, 42, 0.92)"
                              }
                              font-size={String(noteLabelFontSize())}
                              font-weight={isHovered() ? "700" : "600"}
                              text-anchor={layout.textAnchor}
                              text-rendering="geometricPrecision"
                              lengthAdjust="spacingAndGlyphs"
                              style={{ "pointer-events": "none" }}
                            >
                              <For each={layout.lines}>
                                {(line, lineIndex) => (
                                  <tspan
                                    x={renderedTextX}
                                    dy={
                                      lineIndex() === 0
                                        ? "0"
                                        : `${noteLabelFontSize() * 0.95}`
                                    }
                                  >
                                    {line}
                                  </tspan>
                                )}
                              </For>
                            </text>
                            <path
                              d={`M ${layout.leaderStartX - originX} ${layout.leaderStartY - originY} L ${layout.leaderEndX - originX} ${layout.leaderEndY - originY}`}
                              fill="none"
                              stroke={leaderStroke()}
                              stroke-width={isHovered() ? "1.4" : "1.1"}
                              stroke-linecap="round"
                              vector-effect="non-scaling-stroke"
                              style={{ "pointer-events": "none" }}
                            />
                          </g>
                        );
                      }}
                    </For>
                  </Show>
                  <Show when={(() => {
                    const hoveredId = effectiveHoveredId();
                    if (!hoveredId) return null;
                    const doc = listOrdered().find((item) => item.id === hoveredId);
                    if (!doc) return null;
                    const q = props.searchQuery().trim().toLowerCase();
                    if (q && !doc.title.toLowerCase().includes(q)) return null;
                    return doc;
                  })()}>
                    {(doc) => {
                      const pos = createMemo(() => {
                        const listIndex = listOrdered().findIndex(
                          (item) => item.id === doc().id
                        );
                        return (
                          props.positions().get(doc().id) ??
                          seededPositionFor(doc().title, Math.max(0, listIndex), SPREAD)
                        );
                      });
                      const fill = createMemo(() =>
                        colorFor(doc().path || doc().title)
                      );
                      const isDimmed = createMemo(() => {
                        const q = props.searchQuery().trim().toLowerCase();
                        return !!q && !doc().title.toLowerCase().includes(q);
                      });
                      const hoverRadius = createMemo(() =>
                        Math.max(
                          7.5 / zoomScale(),
                          Math.min(12 / zoomScale(), circleRadius() * 1.95)
                        )
                      );
                      return (
                        <g>
                          <circle
                            cx={pos().x}
                            cy={pos().y}
                            r={hoverRadius()}
                            fill="rgba(255,255,255,0.92)"
                            stroke="rgba(37, 99, 235, 0.28)"
                            stroke-width="2"
                            vector-effect="non-scaling-stroke"
                            opacity={noteOpacity()}
                            filter="url(#canvas-hover-note-shadow)"
                            style={{
                              cursor: "pointer",
                              "pointer-events":
                                noteOpacity() > 0.08 ? "auto" : "none",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              props.onSelectDoc(doc().id);
                            }}
                          />
                          <circle
                            cx={pos().x}
                            cy={pos().y}
                            r={hoverRadius() * 0.68}
                            fill={isDimmed() ? "#9CA3AF" : fill()}
                            stroke="#1D4ED8"
                            stroke-width="2.5"
                            vector-effect="non-scaling-stroke"
                            opacity={noteOpacity()}
                            style={{
                              cursor: "pointer",
                              "pointer-events":
                                noteOpacity() > 0.08 ? "auto" : "none",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              props.onSelectDoc(doc().id);
                            }}
                          />
                        </g>
                      );
                    }}
                  </Show>
                </>
              );
            })()}
          </Show>
        </g>
      </svg>
      <Show when={props.selection}>
        {(selection) => {
          const rect = createMemo(() => selection().brushRectScreen());
          return (
            <Show when={selection().isBrushing() && rect()}>
              {(() => {
                const brush = rect()!;
                const left = Math.min(brush.minX, brush.maxX);
                const top = Math.min(brush.minY, brush.maxY);
                const width = Math.abs(brush.maxX - brush.minX);
                const height = Math.abs(brush.maxY - brush.minY);
                return (
                  <Box
                    position="absolute"
                    pointerEvents="none"
                    style={{
                      left: `${left}px`,
                      top: `${top}px`,
                      width: `${width}px`,
                      height: `${height}px`,
                      border: "1px solid #2563EB",
                      background: "rgba(37, 99, 235, 0.08)",
                      "box-shadow": "inset 0 0 0 1px rgba(37,99,235,0.15)",
                    }}
                  />
                );
              })()}
            </Show>
          );
        }}
      </Show>
    </Box>
  );
};
