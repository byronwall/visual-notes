import {
  Show,
  createEffect,
  createMemo,
  createSignal,
  type Accessor,
  type VoidComponent,
} from "solid-js";
import { Box } from "styled-system/jsx";
import type { UmapRegionsSnapshot } from "~/features/umap/region-types";
import { CanvasDotLayer } from "./CanvasDotLayer";
import { seededPositionFor } from "~/layout/seeded";
import type { DocItem } from "~/types/notes";
import type { createSelectionStore } from "~/stores/selection.store";
import { measureCanvasWork } from "./canvas-perf";
import { SPREAD, smoothstep, type Point } from "./labels/label-geometry";
import { CanvasBrushRect } from "./layers/CanvasBrushRect";
import { CanvasNoteMarkers } from "./layers/CanvasNoteMarkers";
import { NoteLabelLayer } from "./layers/NoteLabelLayer";
import { RegionCircleLayer } from "./layers/RegionCircleLayer";
import { RegionLabelLayer } from "./layers/RegionLabelLayer";
import type { RegionInteraction } from "./layers/region-interaction";
import { useCanvasNoteLabels } from "./useCanvasNoteLabels";
import { useCanvasRegionLabels } from "./useCanvasRegionLabels";
import { useRegionLabelDisplayZoom } from "./useRegionLabelDisplayZoom";

type PanZoomHandlers = {
  onWheel: (e: WheelEvent) => void;
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onPointerCancel?: (e: PointerEvent) => void;
  onPointerLeave: () => void;
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
  /** Note open in the side panel; drawn with a persistent ring. */
  activeDocId?: Accessor<string | undefined>;
  /** Ids matching the search, or null when no search is active. */
  matchingDocIds?: Accessor<Set<string> | null>;
  /** Whether notes are hoverable/clickable at the current view. */
  notesInteractive?: Accessor<boolean>;
  isPanning?: Accessor<boolean>;
  selection?: ReturnType<typeof createSelectionStore>;
  // TODO:TYPE_MIRROR, allow extra props to avoid JSX excess property errors during incremental edits
  [key: string]: unknown;
};

const LABEL_CHROME_INSET_PX = 52;

export const VisualCanvas: VoidComponent<VisualCanvasProps> = (props) => {
  const dotHoveredId = createMemo(() => props.hoveredId());
  const effectiveHoveredId = createMemo(
    () => props.railHoveredId?.() ?? dotHoveredId(),
  );
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
  // Labels avoid the floating search bar (top) and zoom controls (bottom).
  const labelViewportBounds = createMemo(() => {
    const bounds = viewportBounds();
    if (!bounds) return undefined;
    const scale = Math.max(0.001, props.scale?.() ?? 1);
    return {
      ...bounds,
      minY: bounds.minY + LABEL_CHROME_INSET_PX / scale,
      maxY: bounds.maxY - LABEL_CHROME_INSET_PX / scale,
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
        pointer.y - selectedRegion.centroid.y,
      ) <= Math.max(18, selectedRegion.radius)
    );
  });
  const isRegionHoverBlocked = (regionId: string) => {
    const selectedId = props.selectedRegionId?.();
    return (
      !!selectedId && regionId !== selectedId && selectedRegionPointerInside()
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

  const docsArr = createMemo(() => props.docs || []);
  const listOrdered = createMemo(() => docsArr());

  const circleRadius = createMemo(() => {
    const s = Math.max(0.001, props.scale?.() ?? 1);
    // Small dots at overview keep dense maps readable; full size
    // once notes become the thing you interact with.
    const screenRadius =
      2.4 + smoothstep(0.35, 0.95, s) * 2.8 - smoothstep(1.2, 4.2, s) * 0.7;
    return screenRadius / s;
  });

  const normalizedRegions = createMemo(() => props.umapRegions?.() ?? null);
  const zoomScale = createMemo(() => Math.max(0.001, props.scale?.() ?? 1));
  const regionLabelDisplayZoom = useRegionLabelDisplayZoom(() => zoomScale());

  const regionLabelFontSize = createMemo(() => 16 / zoomScale());
  const noteLabelFontSize = createMemo(() => 12.5 / zoomScale());
  const regionOpacity = createMemo(() =>
    props.regionsOnly?.()
      ? Math.max(0.65, 1 - smoothstep(0.4, 0.9, zoomScale()))
      : Math.max(0.2, 1 - smoothstep(0.4, 0.9, zoomScale())),
  );
  const regionLabelOpacity = createMemo(() =>
    props.regionsOnly?.()
      ? Math.max(0.88, 1 - smoothstep(0.45, 0.8, zoomScale()))
      : Math.max(0.22, 1 - smoothstep(0.45, 0.8, zoomScale())),
  );
  const hasRegions = createMemo(
    () => (normalizedRegions()?.regions.length ?? 0) > 0,
  );
  const isSearching = createMemo(() => !!props.matchingDocIds?.());
  const noteOpacity = createMemo(() => {
    if (props.regionsOnly?.()) return 0;
    if (!hasRegions() || props.selectedRegionId?.()) return 1;
    if (isSearching()) return 1;
    // Region-first overview: notes sit quietly under the region
    // bubbles and take over as the regions fade on zoom-in.
    return 0.32 + 0.68 * smoothstep(0.5, 0.95, zoomScale());
  });
  const notesInteractive = () => props.notesInteractive?.() ?? false;
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
        return pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY;
      }),
    );
  });

  const regionLabels = useCanvasRegionLabels({
    regions: normalizedRegions,
    zoomScale,
    offset: () => props.offset(),
    labelFontSize: regionLabelFontSize,
    viewportBounds: labelViewportBounds,
    regionsOnly: () => props.regionsOnly?.() ?? false,
    selectedRegionId: () => props.selectedRegionId?.(),
    hoveredRegionId: () => props.hoveredRegionId(),
  });
  const noteLabels = useCanvasNoteLabels({
    visibleDocs: visibleDocsForRender,
    positions: () => props.positions(),
    matchingDocIds: () => props.matchingDocIds?.(),
    notesInteractive,
    dotHoveredId,
    zoomScale,
    labelFontSize: noteLabelFontSize,
    viewportBounds: labelViewportBounds,
    regions: normalizedRegions,
    selectedRegionId: () => props.selectedRegionId?.(),
    regionLabelLayouts: regionLabels.layouts,
    fixedSelectedRegionLayout: regionLabels.fixedSelectedLayout,
  });

  const regionInteraction: RegionInteraction = {
    selectedRegionId: () => props.selectedRegionId?.(),
    hoveredRegionId: () => props.hoveredRegionId(),
    isRegionHoverBlocked,
    onHoveredRegionChange: (id) => props.onHoveredRegionChange(id),
    onPressedRegionChange: (id) => props.onPressedRegionChange(id),
    suppressNextOpen: () => props.suppressNextOpen?.(),
    onZoomToRegion: (id) => props.onZoomToRegion?.(id),
  };
  const showRegions = () => regionOpacity() > 0.02 && !!normalizedRegions();

  return (
    <Box
      position="absolute"
      overflow="hidden"
      bg="bg.default"
      userSelect="none"
      style={{
        left: "0",
        right: "0",
        bottom: "0",
        top: `${props.navHeight()}px`,
        // The canvas owns every gesture: pinch, pan, and wheel never scroll the page.
        "touch-action": "none",
        cursor: props.isPanning?.()
          ? "grabbing"
          : dotHoveredId()
            ? "pointer"
            : undefined,
      }}
      onWheel={props.eventHandlers.onWheel}
      onPointerDown={props.eventHandlers.onPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={props.eventHandlers.onPointerUp}
      onPointerCancel={(e) => props.eventHandlers.onPointerCancel?.(e)}
      onPointerLeave={() => {
        setPointerCanvasPosition(undefined);
        noteLabels.resetHoveredLabel();
        props.eventHandlers.onPointerLeave();
        props.onHoveredRegionChange(undefined);
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: "0", display: "block" }}
      >
        <g transform={props.viewTransform()}>
          <Show when={showRegions()}>
            <RegionCircleLayer
              regions={regionLabels.renderOrder}
              regionOpacity={regionOpacity}
              dotHoveredId={dotHoveredId}
              interaction={regionInteraction}
            />
          </Show>
        </g>
      </svg>
      <CanvasDotLayer
        docs={listOrdered}
        positions={props.positions}
        scale={zoomScale}
        offset={props.offset}
        radius={circleRadius}
        opacity={noteOpacity}
        matchingDocIds={() => props.matchingDocIds?.() ?? null}
      />
      <svg
        width="100%"
        height="100%"
        style={{
          position: "absolute",
          inset: "0",
          display: "block",
          // Only labels and the hovered note take pointers; the rest falls
          // through to the region circles underneath the dot canvas.
          "pointer-events": "none",
        }}
      >
        <g transform={props.viewTransform()}>
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
          <Show when={showRegions()}>
            <RegionLabelLayer
              regions={regionLabels.renderOrder}
              labeledRegionIds={regionLabels.labeledRegionIds}
              layoutById={regionLabels.layoutById}
              fixedSelectedLayout={regionLabels.fixedSelectedLayout}
              labelOpacity={regionLabelOpacity}
              displayZoom={regionLabelDisplayZoom}
              interaction={regionInteraction}
            />
          </Show>
          <NoteLabelLayer
            layouts={noteLabels.layouts}
            docMap={noteLabels.visibleDocMap}
            hoveredId={effectiveHoveredId}
            zoomScale={zoomScale}
            fontSize={noteLabelFontSize}
            noteOpacity={noteOpacity}
            onPointerOverLabel={noteLabels.setPointerOverNoteLabelId}
            onHoveredDocChange={(id) => props.onHoveredDocChange?.(id)}
            suppressNextOpen={() => props.suppressNextOpen?.()}
            onSelectDoc={(id) => props.onSelectDoc(id)}
          />
          <CanvasNoteMarkers
            docs={listOrdered}
            positions={props.positions}
            hoveredId={effectiveHoveredId}
            activeDocId={() => props.activeDocId?.()}
            matchingDocIds={() => props.matchingDocIds?.() ?? null}
            zoomScale={zoomScale}
            circleRadius={circleRadius}
            noteOpacity={noteOpacity}
            onSelectDoc={(id) => props.onSelectDoc(id)}
          />
        </g>
      </svg>
      <Show when={props.selection}>
        {(selection) => <CanvasBrushRect selection={selection()} />}
      </Show>
    </Box>
  );
};
