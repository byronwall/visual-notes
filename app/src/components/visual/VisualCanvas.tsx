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
import type { DocItem } from "~/types/notes";
import type { createSelectionStore } from "~/stores/selection.store";
import { smoothstep, type Point } from "./labels/label-geometry";
import { CanvasBrushRect } from "./layers/CanvasBrushRect";
import { CanvasNoteMarkers } from "./layers/CanvasNoteMarkers";
import { NoteLabelLayer } from "./layers/NoteLabelLayer";
import { RegionLabelLayer } from "./layers/RegionLabelLayer";
import { RegionShapeLayer } from "./layers/RegionShapeLayer";
import type { RegionInteraction } from "./layers/region-interaction";
import { useCanvasNoteLabels } from "./useCanvasNoteLabels";
import { useCanvasRegionLabels } from "./useCanvasRegionLabels";
import { useCanvasRegionShapes } from "./useCanvasRegionShapes";
import { shapeContains } from "./regions/region-shape";
import { useSettledView } from "./useSettledView";

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
  const boundsFor = (scale: number, offset: Point) => {
    const width = props.viewportWidth?.() ?? 0;
    const height = props.viewportHeight?.() ?? 0;
    if (width <= 0 || height <= 0) return undefined;
    const padding = 16 / scale;
    return {
      minX: (-offset.x + padding) / scale,
      minY: (-offset.y + padding) / scale,
      maxX: (width - offset.x - padding) / scale,
      maxY: (height - offset.y - padding) / scale,
    };
  };
  // Labels avoid the floating search bar (top) and zoom controls (bottom).
  const labelBoundsFor = (scale: number, offset: Point) => {
    const bounds = boundsFor(scale, offset);
    if (!bounds) return undefined;
    return {
      ...bounds,
      minY: bounds.minY + LABEL_CHROME_INSET_PX / scale,
      maxY: bounds.maxY - LABEL_CHROME_INSET_PX / scale,
    };
  };
  const labelViewportBounds = createMemo(() =>
    labelBoundsFor(Math.max(0.001, props.scale?.() ?? 1), props.offset()),
  );
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
  const regionShapes = useCanvasRegionShapes({
    regions: () => props.umapRegions?.()?.regions ?? [],
    positions: () => props.positions(),
  });
  const selectedRegionPointerInside = createMemo(() => {
    const selectedId = props.selectedRegionId?.();
    const pointer = pointerCanvasPosition();
    if (!selectedId || !pointer) return false;
    const shape = regionShapes.shapes().get(selectedId);
    return !!shape && shapeContains(shape, pointer);
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

  // 0 at overview, 1 once notes are the thing you interact with. Dots,
  // their tint, and their size all follow it, so nothing pops on zoom.
  const noteEmphasis = createMemo(() =>
    smoothstep(0.45, 0.95, Math.max(0.001, props.scale?.() ?? 1)),
  );
  const circleRadius = createMemo(() => {
    const s = Math.max(0.001, props.scale?.() ?? 1);
    const screenRadius =
      2 + noteEmphasis() * 3.2 - smoothstep(1.2, 4.2, s) * 0.7;
    return screenRadius / s;
  });

  const normalizedRegions = createMemo(() => props.umapRegions?.() ?? null);
  const regionList = createMemo(() => normalizedRegions()?.regions ?? []);
  const zoomScale = createMemo(() => Math.max(0.001, props.scale?.() ?? 1));
  // Labels are planned for this view, which moves only once zoom and pan
  // have been still for a moment.
  const settled = useSettledView({
    zoom: zoomScale,
    offset: () => props.offset(),
  });
  const settledView = settled.view;
  const settledLabelBounds = createMemo(() => {
    const view = settledView();
    return labelBoundsFor(view.zoom, view.offset);
  });
  // Mid-gesture, labels laid out for a closer zoom fade as you zoom out
  // past it instead of piling up; they return once the view settles.
  const labelGestureFade = createMemo(() =>
    smoothstep(0.55, 0.85, zoomScale() / settledView().zoom),
  );

  const regionOpacity = createMemo(() =>
    props.regionsOnly?.()
      ? Math.max(0.65, 1 - smoothstep(0.4, 0.9, zoomScale()))
      : Math.max(0.2, 1 - smoothstep(0.4, 0.9, zoomScale())),
  );
  const regionLabelOpacity = createMemo(
    () =>
      labelGestureFade() *
      (props.regionsOnly?.()
        ? Math.max(0.88, 1 - smoothstep(0.45, 0.8, zoomScale()))
        : Math.max(0.22, 1 - smoothstep(0.45, 0.8, zoomScale()))),
  );
  const hasRegions = createMemo(
    () => (normalizedRegions()?.regions.length ?? 0) > 0,
  );
  const isSearching = createMemo(() => !!props.matchingDocIds?.());
  const noteFocus = createMemo(
    () => !hasRegions() || !!props.selectedRegionId?.() || isSearching(),
  );
  const noteOpacity = createMemo(() => {
    if (props.regionsOnly?.()) return 0;
    if (noteFocus()) return 1;
    // Region-first overview: dots sit faintly inside their region shapes
    // and take over as the shapes fade on zoom-in.
    return 0.3 + 0.7 * noteEmphasis();
  });
  const dotTintAmount = createMemo(() =>
    noteFocus() ? 0 : 0.85 * (1 - noteEmphasis()),
  );
  const notesInteractive = () => props.notesInteractive?.() ?? false;

  const regionLabels = useCanvasRegionLabels({
    regions: regionList,
    shapes: regionShapes.shapes,
    settledZoom: () => settledView().zoom,
    regionsOnly: () => props.regionsOnly?.() ?? false,
    selectedRegionId: () => props.selectedRegionId?.(),
    hoveredRegionId: () => props.hoveredRegionId(),
  });
  const noteLabels = useCanvasNoteLabels({
    docs: listOrdered,
    positions: () => props.positions(),
    matchingDocIds: () => props.matchingDocIds?.(),
    notesInteractive,
    dotHoveredId,
    zoomScale,
    settledView,
    planEpoch: settled.epoch,
    requestReplan: settled.requestReplan,
    settledBounds: settledLabelBounds,
    liveBounds: labelViewportBounds,
    regions: regionList,
    selectedRegionId: () => props.selectedRegionId?.(),
    regionLabelBoxes: regionLabels.occupiedBoxes,
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
            <RegionShapeLayer
              regions={regionLabels.shapeOrder}
              shapes={regionShapes.shapes}
              tones={regionShapes.tones}
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
        tints={regionShapes.dotTints}
        tintAmount={dotTintAmount}
      />
      <svg
        width="100%"
        height="100%"
        style={{
          position: "absolute",
          inset: "0",
          display: "block",
          // Only labels and the hovered note take pointers; the rest falls
          // through to the region shapes underneath the dot canvas.
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
              regions={regionLabels.labelOrder}
              layouts={regionLabels.layouts}
              labeledRegionIds={regionLabels.labeledRegionIds}
              labelOpacity={regionLabelOpacity}
              zoom={zoomScale}
              interaction={regionInteraction}
            />
          </Show>
          <NoteLabelLayer
            labels={noteLabels.labels}
            docMap={noteLabels.docMap}
            hoveredId={effectiveHoveredId}
            zoomScale={zoomScale}
            gestureFade={labelGestureFade}
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
