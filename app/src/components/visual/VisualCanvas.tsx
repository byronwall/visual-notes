import {
  For,
  Show,
  createMemo,
  type Accessor,
  type VoidComponent,
} from "solid-js";
import { Box } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
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
  leaderEndX: number;
  leaderEndY: number;
  elbowX: number;
  elbowY: number;
  edgeX: number;
  edgeY: number;
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
  hoveredLabelScreen: Accessor<
    { x: number; y: number; title: string } | undefined
  >;
  showHoverLabel: Accessor<boolean>;
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

function wrapRegionTitle(title: string, maxChars = 16, maxLines = 3) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [title];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || current.length === 0) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (current) {
    if (lines.length < maxLines) lines.push(current);
    else lines[maxLines - 1] = `${lines[maxLines - 1]} ${current}`.trim();
  }
  return lines.slice(0, maxLines);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
  const angles = [
    -155, -132, -110, -86, -62, -36, -14, 14, 36, 62, 86, 110, 132, 155,
  ].map((deg) => (deg * Math.PI) / 180);
  const radialSteps = [6, 14, 26, 40].map((step) => step / args.zoomScale);
  const labelSpacingX = 12 / args.zoomScale;
  const labelSpacingY = 9 / args.zoomScale;

  for (const region of selected) {
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

    for (const radial of radialSteps) {
      for (const angle of angles) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const anchorX = region.centroid.x + cos * (radius + radial);
        const anchorY = region.centroid.y + sin * (radius + radial);
        const textAnchor = (
          cos > 0.42 ? "start" : cos < -0.42 ? "end" : "middle"
        ) as "start" | "middle" | "end";
        const textX =
          textAnchor === "middle"
            ? anchorX
            : anchorX + Math.sign(cos) * (4 / args.zoomScale);
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
          sin < -0.18
            ? anchorY - labelHeight
            : sin > 0.18
              ? anchorY
              : anchorY - labelHeight / 2;
        let boxMaxY = boxMinY + labelHeight;
        let adjustedTextX = textX;

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
          adjustedTextX += shiftX;
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
        let circlePenalty = 0;
        let clearance = Number.POSITIVE_INFINITY;
        if (!args.allowRegionOverlap) {
          for (const other of args.regions) {
            const pad =
              other.id === region.id ? 4 / args.zoomScale : 10 / args.zoomScale;
            const closestX = clamp(other.centroid.x, boxMinX, boxMaxX);
            const closestY = clamp(other.centroid.y, boxMinY, boxMaxY);
            const dxToBox = other.centroid.x - closestX;
            const dyToBox = other.centroid.y - closestY;
            const distanceToBox = Math.sqrt(
              dxToBox * dxToBox + dyToBox * dyToBox
            );
            const gap = distanceToBox - (Math.max(18, other.radius) + pad);
            clearance = Math.min(clearance, gap);
            if (gap < 0) {
              circlePenalty += gap * gap;
            }
          }
        }
        const centerY = (boxMinY + boxMaxY) / 2;
        const leaderEndX = clamp(region.centroid.x, boxMinX, boxMaxX);
        const leaderEndY = clamp(region.centroid.y, boxMinY, boxMaxY);
        const dx = leaderEndX - region.centroid.x;
        const dy = leaderEndY - region.centroid.y;
        const leaderLength = Math.sqrt(dx * dx + dy * dy);
        const opennessReward = args.allowRegionOverlap
          ? 0
          : Math.max(0, Math.min(140 / args.zoomScale, clearance));
        const angularBias = sin < -0.2 ? -8 : sin > 0.45 ? 5 : 0;
        const score =
          overlapPenalty * 1400 +
          offscreenPenalty * 2200 +
          circlePenalty * 10 +
          leaderLength * 1.1 +
          Math.abs(centerY - region.centroid.y) * 0.015 -
          opennessReward * 0.9 +
          angularBias;

        if (!best || score < best.score) {
          const safeLength = Math.max(1, leaderLength);
          best = {
            regionId: region.id,
            lines,
            textAnchor,
            textX: adjustedTextX,
            textY: boxMinY + args.labelFontSize * 0.9,
            leaderEndX,
            leaderEndY,
            elbowX:
              textAnchor === "start"
                ? leaderEndX - 2.5 / args.zoomScale
                : textAnchor === "end"
                  ? leaderEndX + 2.5 / args.zoomScale
                  : leaderEndX,
            elbowY: leaderEndY,
            edgeX: region.centroid.x + (dx / safeLength) * radius,
            edgeY: region.centroid.y + (dy / safeLength) * radius,
            minX: boxMinX,
            minY: boxMinY,
            maxX: boxMaxX,
            maxY: boxMaxY,
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

export const VisualCanvas: VoidComponent<VisualCanvasProps> = (props) => {
  const effectiveHoveredId = createMemo(
    () => props.railHoveredId?.() ?? props.hoveredId()
  );
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
  const noteHoverOpacity = createMemo(() =>
    props.regionsOnly?.()
      ? 0
      : smoothstep(0.5, 0.95, Math.max(0.001, props.scale?.() ?? 1))
  );

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
      onPointerMove={props.eventHandlers.onPointerMove}
      onPointerUp={props.eventHandlers.onPointerUp}
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
                const alpha = 1.2; // shrink against zoom: r_world = base / s^alpha
                const rWorld = 8 / Math.pow(s, alpha);
                return Math.max(0.8, Math.min(8, rWorld));
              });

              const normalizedRegions = createMemo(
                () => props.umapRegions?.() ?? null
              );
              const zoomScale = createMemo(() =>
                Math.max(0.001, props.scale?.() ?? 1)
              );
              const regionLabelFontSize = createMemo(() =>
                Math.max(18, Math.min(38, 11 / zoomScale()))
              );
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
              const noteOpacity = createMemo(() =>
                props.regionsOnly?.() ? 0 : zoomScale() >= 0.96 ? 1 : 0
              );
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
                return measureCanvasWork("baseRegionLabelLayouts", () =>
                  buildRegionLabelLayouts({
                    regions,
                    labeledIds: labelIds,
                    labelOrder,
                    emphasizedIds,
                    zoomScale: currentZoomScale,
                    labelFontSize,
                    allowRegionOverlap: true,
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
              const labelRenderOrder = createMemo(() => {
                const hoveredId = props.hoveredRegionId();
                return (normalizedRegions()?.regions ?? []).slice().sort((a, b) => {
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
                      {() => (
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
                                    "pointer-events": "auto",
                                  }}
                                  onPointerEnter={() =>
                                    props.onHoveredRegionChange(region.id)
                                  }
                                  onPointerLeave={() =>
                                    props.onHoveredRegionChange(undefined)
                                  }
                                  onPointerDown={() => {
                                    props.onHoveredRegionChange(region.id);
                                    props.onPressedRegionChange(region.id);
                                    props.suppressNextOpen?.();
                                  }}
                                  onClick={(e) => {
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
                                      when={regionLabelLayoutById().get(region.id)}
                                    >
                                      {(layout) => {
                                        const isHovered =
                                          props.hoveredRegionId() === region.id;
                                        const isSelected =
                                          props.selectedRegionId?.() === region.id;
                                        const padX = 6 / zoomScale();
                                        const padY = 4 / zoomScale();
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
                                              "pointer-events": "auto",
                                              transform: `translate(${originX}px, ${originY}px)`,
                                              "transform-origin": "0 0",
                                              transition:
                                                "transform 260ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 180ms ease",
                                              "will-change": "transform",
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
                                                layout().maxX -
                                                layout().minX +
                                                padX * 2
                                              }
                                              height={
                                                layout().maxY -
                                                layout().minY +
                                                padY * 2
                                              }
                                              rx={8 / zoomScale()}
                                              ry={8 / zoomScale()}
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
                                            <path
                                              d={`M ${layout().edgeX - originX} ${layout().edgeY - originY} L ${layout().elbowX - originX} ${layout().elbowY - originY} L ${layout().leaderEndX - originX} ${layout().leaderEndY - originY}`}
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
                                            <text
                                              x={layout().textX - originX}
                                              y={layout().textY - originY}
                                              fill={
                                                isSelected || isHovered
                                                  ? "#0f172a"
                                                  : "#172554"
                                              }
                                              font-size={String(regionLabelFontSize())}
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
                                                  ? 7 / zoomScale()
                                                  : isHovered
                                                  ? 6 / zoomScale()
                                                  : 4 / zoomScale()
                                              )}
                                              stroke-linejoin="round"
                                              style={{
                                                filter: isSelected
                                                  ? "drop-shadow(0 3px 10px rgba(37, 99, 235, 0.16))"
                                                  : isHovered
                                                  ? "drop-shadow(0 2px 6px rgba(249, 115, 22, 0.14))"
                                                  : "drop-shadow(0 1px 2px rgba(15, 23, 42, 0.08))",
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
                                              <For each={layout().lines}>
                                                {(line, lineIndex) => (
                                                  <tspan
                                                    x={layout().textX - originX}
                                                    dy={
                                                      lineIndex() === 0
                                                        ? "0"
                                                        : `${regionLabelFontSize() * 0.95}`
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
                      )}
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
                        Math.min(18, Math.max(7, circleRadius() * 2.7))
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
      {(() => {
        const hoveredIsMatch = createMemo(() => {
          const id = effectiveHoveredId();
          if (!id) return false;
          const q = props.searchQuery().trim().toLowerCase();
          if (!q) return true;
          const d = (props.docs || []).find((x) => x.id === id);
          return d ? d.title.toLowerCase().includes(q) : false;
        });
        const showHover = createMemo(() => {
          if (noteHoverOpacity() < 0.16) return false;
          const hasLbl = !!props.hoveredLabelScreen();
          if (!hasLbl) return false;
          if (!hoveredIsMatch()) return false;
          return true;
        });
        const lbl = createMemo(() => props.hoveredLabelScreen());
        return (
          <>
            <Show when={showHover()}>
              {(() => {
                const l = lbl()!;
                return (
                  <Box
                    position="absolute"
                    style={{
                      left: `${l.x + 12}px`,
                      top: `${l.y - 10}px`,
                      "pointer-events": "none",
                    }}
                  >
                    <Box
                      bg="bg.default"
                      borderWidth="1px"
                      borderColor="border"
                      px="2"
                      py="1"
                      borderRadius="l2"
                      boxShadow="md"
                      maxW="320px"
                      whiteSpace="nowrap"
                      textOverflow="ellipsis"
                      overflow="hidden"
                      style={{
                        background: "rgba(255,255,255,0.98)",
                        border: "1px solid rgba(0,0,0,0.15)",
                      }}
                    >
                      <Text as="span" fontSize="sm" color="fg.default">
                        {l.title}
                      </Text>
                    </Box>
                  </Box>
                );
              })()}
            </Show>
          </>
        );
      })()}
    </Box>
  );
};
