import {
  For,
  Show,
  createEffect,
  createMemo,
  type Accessor,
  type VoidComponent,
} from "solid-js";
import { Box } from "styled-system/jsx";
import { CanvasHexCardLayer } from "~/components/visual/CanvasHexCardLayer";
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

export type VisualCanvasProps = {
  docs: DocItem[] | undefined;
  positions: Accessor<Map<string, Point>>;
  umapIndex: Accessor<Map<string, { x: number; y: number }>>;
  umapRegions?: Accessor<UmapRegionsSnapshot | null>;
  hoveredId: Accessor<string | undefined>;
  hoveredLabelScreen: Accessor<
    { x: number; y: number; title: string } | undefined
  >;
  showHoverLabel: Accessor<boolean>;
  viewTransform: Accessor<string>;
  offset: Accessor<Point>;
  navHeight: Accessor<number>;
  scale?: Accessor<number>;
  searchQuery: Accessor<string>;
  hideNonMatches: Accessor<boolean>;
  layoutMode: Accessor<"umap" | "regions" | "grid" | "hex">;
  nestByPath: Accessor<boolean>;
  eventHandlers: PanZoomHandlers;
  hoveredRegionId: Accessor<string | undefined>;
  onHoveredRegionChange: (id: string | undefined) => void;
  onPressedRegionChange: (id: string | undefined) => void;
  suppressNextOpen?: () => void;
  onSelectDoc: (id: string) => void;
  onZoomToRegion?: (id: string) => void;
  selection?: ReturnType<typeof createSelectionStore>;
  // TODO:TYPE_MIRROR, allow extra props to avoid JSX excess property errors during incremental edits
  [key: string]: unknown;
};

const SPREAD = 1000;

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

function buildRegionLabelLayouts(args: {
  regions: NonNullable<UmapRegionsSnapshot["regions"]>;
  labeledIds: Set<string>;
  hoveredRegionId?: string;
  zoomScale: number;
  labelFontSize: number;
}) {
  const selected = args.regions
    .filter(
      (region) =>
        args.labeledIds.has(region.id) || args.hoveredRegionId === region.id
    )
    .slice()
    .sort((a, b) => {
      if (a.id === args.hoveredRegionId) return -1;
      if (b.id === args.hoveredRegionId) return 1;
      return b.docCount - a.docCount || b.radius - a.radius;
    });

  const placed: Array<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }> = [];
  const layouts: RegionLabelLayout[] = [];
  const lineGap = 6 / args.zoomScale;
  const angles = [
    -155, -132, -110, -86, -62, -36, -14, 14, 36, 62, 86, 110, 132, 155,
  ].map((deg) => (deg * Math.PI) / 180);
  const radialSteps = [6, 14, 26, 40].map((step) => step / args.zoomScale);

  for (const region of selected) {
    const lines = wrapRegionTitle(region.title, 16, 3);
    const radius = Math.max(18, region.radius);
    const lineHeight = args.labelFontSize * 0.9;
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
        const boxMinX =
          textAnchor === "start"
            ? textX
            : textAnchor === "end"
              ? textX - labelWidth
              : textX - labelWidth / 2;
        const boxMaxX =
          textAnchor === "start"
            ? textX + labelWidth
            : textAnchor === "end"
              ? textX
              : textX + labelWidth / 2;
        const boxMinY =
          sin < -0.18
            ? anchorY - labelHeight
            : sin > 0.18
              ? anchorY
              : anchorY - labelHeight / 2;
        const boxMaxY = boxMinY + labelHeight;
        const overlapPenalty = placed.reduce((penalty, box) => {
          const overlapX = Math.max(
            0,
            Math.min(boxMaxX, box.maxX) - Math.max(boxMinX, box.minX)
          );
          const overlapY = Math.max(
            0,
            Math.min(boxMaxY, box.maxY) - Math.max(boxMinY, box.minY)
          );
          return penalty + overlapX * overlapY;
        }, 0);
        let circlePenalty = 0;
        let clearance = Number.POSITIVE_INFINITY;
        for (const other of args.regions) {
          const pad =
            other.id === region.id ? 4 / args.zoomScale : 10 / args.zoomScale;
          const closestX = clamp(other.centroid.x, boxMinX, boxMaxX);
          const closestY = clamp(other.centroid.y, boxMinY, boxMaxY);
          const dxToBox = other.centroid.x - closestX;
          const dyToBox = other.centroid.y - closestY;
          const distanceToBox = Math.sqrt(dxToBox * dxToBox + dyToBox * dyToBox);
          const gap = distanceToBox - (Math.max(18, other.radius) + pad);
          clearance = Math.min(clearance, gap);
          if (gap < 0) {
            circlePenalty += gap * gap;
          }
        }
        const centerX = (boxMinX + boxMaxX) / 2;
        const centerY = (boxMinY + boxMaxY) / 2;
        const leaderEndX = clamp(region.centroid.x, boxMinX, boxMaxX);
        const leaderEndY = clamp(region.centroid.y, boxMinY, boxMaxY);
        const dx = leaderEndX - region.centroid.x;
        const dy = leaderEndY - region.centroid.y;
        const leaderLength = Math.sqrt(dx * dx + dy * dy);
        const opennessReward = Math.max(0, Math.min(140 / args.zoomScale, clearance));
        const angularBias = sin < -0.2 ? -8 : sin > 0.45 ? 5 : 0;
        const score =
          overlapPenalty * 1400 +
          circlePenalty * 18 +
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
            textX,
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
      minX: best.minX,
      minY: best.minY,
      maxX: best.maxX,
      maxY: best.maxY,
    });
    layouts.push(best);
  }

  return layouts;
}

export const VisualCanvas: VoidComponent<VisualCanvasProps> = (props) => {
  const noteHoverOpacity = createMemo(() =>
    props.layoutMode() === "hex"
      ? 1
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
              const listOrdered = createMemo(() => {
                const list = docsArr();
                if (!list) return [] as DocItem[];
                if (!props.nestByPath() || props.layoutMode() !== "grid")
                  return list;
                const byTop = new Map<string, DocItem[]>();
                for (const d of list) {
                  const top =
                    (d.path || "").split(".").filter(Boolean)[0] || "∅";
                  const arr = byTop.get(top) || [];
                  arr.push(d);
                  byTop.set(top, arr);
                }
                const groups = Array.from(byTop.keys()).sort((a, b) =>
                  a.localeCompare(b)
                );
                const index = props.umapIndex();
                const out: DocItem[] = [];
                for (const g of groups) {
                  const arr = byTop.get(g)!;
                  arr.sort((a, b) => {
                    const pa = index.get(a.id);
                    const pb = index.get(b.id);
                    const xa = pa ? pa.x : 0;
                    const xb = pb ? pb.x : 0;
                    return xa - xb;
                  });
                  out.push(...arr);
                }
                return out;
              });

              const circleRadius = createMemo(() => {
                const s = Math.max(0.001, props.scale?.() ?? 1);
                if (props.layoutMode() === "grid") return 10;
                if (props.layoutMode() === "hex") return Math.max(3, 6 / s);
                const alpha = 1.2; // shrink against zoom: r_world = base / s^alpha
                const rWorld = 8 / Math.pow(s, alpha);
                return Math.max(0.8, Math.min(8, rWorld));
              });

              const pathBoxes = createMemo(() => {
                if (!props.nestByPath() || props.layoutMode() !== "grid")
                  return [] as {
                    key: string;
                    depth: number;
                    minX: number;
                    minY: number;
                    maxX: number;
                    maxY: number;
                  }[];
                const list = docsArr() || [];
                const pos = props.positions();
                const tree = new Map<
                  string,
                  { ids: string[]; depth: number }
                >();
                for (const d of list) {
                  const segments = (d.path || "").split(".").filter(Boolean);
                  let prefix = "";
                  for (let i = 0; i < segments.length; i++) {
                    prefix = prefix ? `${prefix}.${segments[i]}` : segments[i]!;
                    const node = tree.get(prefix) || { ids: [], depth: i + 1 };
                    node.ids.push(d.id);
                    tree.set(prefix, node);
                  }
                }
                const boxes: {
                  key: string;
                  depth: number;
                  minX: number;
                  minY: number;
                  maxX: number;
                  maxY: number;
                }[] = [];
                for (const [key, node] of tree) {
                  let minX = Number.POSITIVE_INFINITY;
                  let minY = Number.POSITIVE_INFINITY;
                  let maxX = Number.NEGATIVE_INFINITY;
                  let maxY = Number.NEGATIVE_INFINITY;
                  for (const id of node.ids) {
                    const p = pos.get(id);
                    if (!p) continue;
                    if (p.x < minX) minX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y > maxY) maxY = p.y;
                  }
                  if (
                    !Number.isFinite(minX) ||
                    !Number.isFinite(minY) ||
                    !Number.isFinite(maxX) ||
                    !Number.isFinite(maxY)
                  )
                    continue;
                  const pad = 18;
                  boxes.push({
                    key,
                    depth: node.depth,
                    minX: minX - pad,
                    minY: minY - pad,
                    maxX: maxX + pad,
                    maxY: maxY + pad,
                  });
                }
                boxes.sort((a, b) => a.depth - b.depth);
                return boxes;
              });

              const normalizedRegions = createMemo(
                () => props.umapRegions?.() ?? null
              );
              const zoomScale = createMemo(() =>
                Math.max(0.001, props.scale?.() ?? 1)
              );
              const regionLabelFontSize = createMemo(() =>
                Math.max(20, Math.min(42, 12 / zoomScale()))
              );
              const regionOpacity = createMemo(
                () => Math.max(0.2, 1 - smoothstep(0.4, 0.9, zoomScale()))
              );
              const regionLabelOpacity = createMemo(
                () => Math.max(0.22, 1 - smoothstep(0.45, 0.8, zoomScale()))
              );
              const noteOpacity = createMemo(() =>
                props.layoutMode() === "hex"
                  ? 1
                  : zoomScale() >= 0.82
                    ? 1
                    : 0
              );
              const regionInteractive = createMemo(
                () =>
                  props.layoutMode() !== "hex" &&
                  zoomScale() < 1.2 &&
                  noteOpacity() < 1
              );
              createEffect(() => {
                if (!regionInteractive() && props.hoveredRegionId()) {
                  props.onHoveredRegionChange(undefined);
                  props.onPressedRegionChange(undefined);
                }
              });
              const labeledRegionIds = createMemo(() => {
                const regions = normalizedRegions()?.regions ?? [];
                return new Set(
                  regions
                    .slice()
                    .sort(
                      (a, b) =>
                        b.docCount - a.docCount || b.radius - a.radius
                    )
                    .slice(0, 28)
                    .map((region) => region.id)
                );
              });
              const regionLabelLayouts = createMemo(() =>
                buildRegionLabelLayouts({
                  regions: normalizedRegions()?.regions ?? [],
                  labeledIds: labeledRegionIds(),
                  hoveredRegionId: props.hoveredRegionId(),
                  zoomScale: zoomScale(),
                  labelFontSize: regionLabelFontSize(),
                })
              );
              const regionLabelLayoutById = createMemo(
                () =>
                  new Map(
                    regionLabelLayouts().map((layout) => [layout.regionId, layout])
                  )
              );

              return (
                <>
                  <For each={pathBoxes()}>
                    {(b) => {
                      const isGrid = props.layoutMode() === "grid";
                      const boxFill = isGrid ? "#e5e7eb" : "#f8fafc"; // darker bg in Z-order view
                      const boxStroke = isGrid ? "#475569" : "#cbd5e1"; // thicker, darker border in Z-order view
                      const boxStrokeW = isGrid ? 3 : 1;
                      return (
                        <g>
                          <rect
                            x={b.minX}
                            y={b.minY}
                            width={b.maxX - b.minX}
                            height={b.maxY - b.minY}
                            rx={8}
                            ry={8}
                            fill={boxFill}
                            stroke={boxStroke}
                            stroke-width={boxStrokeW}
                            vector-effect="non-scaling-stroke"
                          />
                        </g>
                      );
                    }}
                  </For>
                  <For each={listOrdered()}>
                    {(d, i) => {
                      const pos = createMemo(
                        () =>
                          props.positions().get(d.id) ??
                          seededPositionFor(d.title, i(), SPREAD)
                      );
                      const fill = createMemo(() =>
                        props.layoutMode() !== "grid"
                          ? colorFor(d.path || d.title)
                          : colorFor(d.title)
                      );
                      const isSelected = createMemo(() =>
                        props.selection
                          ? props.selection.isSelected(d.id)
                          : false
                      );
                      const matchesSearch = createMemo(() => {
                        const q = props.searchQuery().trim().toLowerCase();
                        if (!q) return true;
                        return d.title.toLowerCase().includes(q);
                      });
                      const dimmed = createMemo(
                        () => !!props.searchQuery().trim() && !matchesSearch()
                      );
                      return (
                        <Show when={!props.hideNonMatches() || matchesSearch()}>
                          <g>
                            <circle
                              cx={pos().x}
                              cy={pos().y}
                              r={circleRadius()}
                              fill={dimmed() ? "#9CA3AF" : fill()}
                              stroke={
                                isSelected()
                                  ? "#1D4ED8"
                                  : dimmed()
                                    ? "#00000010"
                                    : "#00000020"
                              }
                              stroke-width={isSelected() ? 3 : 1}
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
                  <Show when={props.layoutMode() !== "hex" && regionOpacity() > 0.02}>
                    <Show when={normalizedRegions()}>
                      {(regions) => (
                        <>
                          <For each={regions().regions}>
                            {(region) => (
                              <g>
                                <circle
                                  cx={region.centroid.x}
                                  cy={region.centroid.y}
                                  r={Math.max(18, region.radius)}
                                  fill={
                                    props.hoveredRegionId() === region.id
                                      ? "rgba(37, 99, 235, 0.16)"
                                      : "rgba(37, 99, 235, 0.06)"
                                  }
                                  stroke={
                                    props.hoveredRegionId() === region.id
                                      ? "rgba(30, 64, 175, 0.7)"
                                      : "rgba(37, 99, 235, 0.2)"
                                  }
                                  stroke-width={
                                    props.hoveredRegionId() === region.id
                                      ? "2.5"
                                      : "1.5"
                                  }
                                  vector-effect="non-scaling-stroke"
                                  opacity={
                                    props.hoveredRegionId() === region.id
                                      ? Math.max(0.4, regionOpacity())
                                      : regionOpacity()
                                  }
                                  style={{
                                    cursor: regionInteractive()
                                      ? "pointer"
                                      : "default",
                                    "pointer-events": regionInteractive()
                                      ? "auto"
                                      : "none",
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
                                <Show when={regionLabelOpacity() > 0.04}>
                                  <Show
                                    when={
                                      props.hoveredRegionId() === region.id ||
                                      labeledRegionIds().has(region.id)
                                    }
                                  >
                                    {(() => {
                                      const layout =
                                        regionLabelLayoutById().get(region.id);
                                      if (!layout) return null;
                                      const isHovered =
                                        props.hoveredRegionId() === region.id;
                                      return (
                                        <g
                                          opacity={
                                            isHovered
                                              ? Math.max(0.95, regionLabelOpacity())
                                              : regionLabelOpacity()
                                          }
                                          style={{
                                            cursor: regionInteractive()
                                              ? "pointer"
                                              : "default",
                                            "pointer-events": regionInteractive()
                                              ? "auto"
                                              : "none",
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
                                        >
                                          <rect
                                            x={layout.minX - 6 / zoomScale()}
                                            y={layout.minY - 4 / zoomScale()}
                                            width={
                                              layout.maxX -
                                              layout.minX +
                                              12 / zoomScale()
                                            }
                                            height={
                                              layout.maxY -
                                              layout.minY +
                                              8 / zoomScale()
                                            }
                                            rx={8 / zoomScale()}
                                            ry={8 / zoomScale()}
                                            fill="transparent"
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
                                          <path
                                            d={`M ${layout.edgeX} ${layout.edgeY} L ${layout.elbowX} ${layout.elbowY} L ${layout.leaderEndX} ${layout.leaderEndY}`}
                                            fill="none"
                                            stroke={
                                              isHovered
                                                ? "rgba(30, 64, 175, 0.5)"
                                                : "rgba(37, 99, 235, 0.3)"
                                            }
                                            stroke-width={isHovered ? "1.6" : "1.25"}
                                            vector-effect="non-scaling-stroke"
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
                                          <text
                                            x={layout.textX}
                                            y={layout.textY}
                                            fill={isHovered ? "#0f172a" : "#172554"}
                                            font-size={String(regionLabelFontSize())}
                                            font-weight="700"
                                            text-anchor={layout.textAnchor}
                                            paint-order="stroke"
                                            stroke={
                                              isHovered
                                                ? "rgba(255,255,255,0.98)"
                                                : "rgba(255,255,255,0.88)"
                                            }
                                            stroke-width={String(
                                              isHovered
                                                ? 6 / zoomScale()
                                                : 4 / zoomScale()
                                            )}
                                            stroke-linejoin="round"
                                            style={{
                                              filter: isHovered
                                                ? "drop-shadow(0 2px 6px rgba(15, 23, 42, 0.16))"
                                                : "drop-shadow(0 1px 2px rgba(15, 23, 42, 0.08))",
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
                                          >
                                            <For each={layout.lines}>
                                              {(line, lineIndex) => (
                                                <tspan
                                                  x={layout.textX}
                                                  dy={
                                                    lineIndex() === 0
                                                      ? "0"
                                                      : `${regionLabelFontSize() * 0.95}`
                                                  }
                                                  onPointerEnter={() =>
                                                    props.onHoveredRegionChange(region.id)
                                                  }
                                                  onPointerLeave={() =>
                                                    props.onHoveredRegionChange(
                                                      undefined
                                                    )
                                                  }
                                                  onPointerDown={() => {
                                                    props.onHoveredRegionChange(
                                                      region.id
                                                    );
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
                                    })()}
                                  </Show>
                                </Show>
                              </g>
                            )}
                          </For>
                        </>
                      )}
                    </Show>
                  </Show>
                </>
              );
            })()}
          </Show>
        </g>
      </svg>
      <Show when={props.layoutMode() === "hex"}>
        <CanvasHexCardLayer
          docs={props.docs || []}
          positions={props.positions}
          scale={props.scale || (() => 1)}
          offset={props.offset}
          hoveredId={props.hoveredId}
          showHoverLabel={props.showHoverLabel}
          onSelectDoc={props.onSelectDoc}
          isSelected={(id) =>
            props.selection ? props.selection.isSelected(id) : false
          }
          hideNonMatches={props.hideNonMatches}
          searchQuery={props.searchQuery}
        />
      </Show>
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
          const id = props.hoveredId();
          if (!id) return false;
          const q = props.searchQuery().trim().toLowerCase();
          if (!q) return true;
          const d = (props.docs || []).find((x) => x.id === id);
          return d ? d.title.toLowerCase().includes(q) : false;
        });
        const showHover = createMemo(() => {
          if (props.layoutMode() === "hex") return false;
          if (props.hoveredRegionId()) return false;
          if (noteHoverOpacity() < 0.16) return false;
          const hasLbl = !!props.hoveredLabelScreen();
          if (!hasLbl) return false;
          if (props.hideNonMatches() && !hoveredIsMatch()) return false;
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
