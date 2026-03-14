import {
  type VoidComponent,
  createEffect,
  createSignal,
  createMemo,
  Show,
  onCleanup,
  onMount,
  createResource,
  Suspense,
} from "solid-js";
import { Box } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import { ControlPanel } from "~/components/visual/ControlPanel";
import {
  CANVAS_SIDE_RAIL_WIDTH_PX,
  CanvasSideRail,
} from "~/components/visual/CanvasSideRail";
import { VisualCanvas } from "~/components/visual/VisualCanvas";
import { createHoverDerivations } from "~/hooks/useHover";
import { createPanZoomHandlers } from "~/hooks/usePanZoom";
import { seededPositionFor } from "~/layout/seeded";
import { normalizeUmapRegions } from "~/layout/umap-normalize";
import {
  useUmapPointsResource,
  useUmapRunResource,
} from "~/services/docs.resources";
import { fetchDocs } from "~/features/docs-index/data/docs.service";
import { createCanvasStore } from "~/stores/canvas.store";
import { createPositionsStore } from "~/stores/positions.store";
import { createSelectionStore } from "~/stores/selection.store";
import { DocumentSidePanel } from "~/components/DocumentSidePanel";
import type { DocItem } from "~/types/notes";

const SPREAD = 1000;
const isBrowser = typeof window !== "undefined";
const FULL_VIEW_PADDING = 120;
const DESKTOP_RAIL_BREAKPOINT = 700;
const RAIL_GUTTER_PX = 40;

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

function getRailInset(viewportWidth: number) {
  if (viewportWidth < DESKTOP_RAIL_BREAKPOINT) return 0;
  return CANVAS_SIDE_RAIL_WIDTH_PX + RAIL_GUTTER_PX;
}

const CanvasRoute: VoidComponent = () => {
  const [docs, { refetch: refetchDocs }] = createResource(
    () => true,
    () => fetchDocs({})
  );
  const umapRun = useUmapRunResource();
  // Refetch points whenever the latest run id changes to avoid stale data after client navigation
  const umapPoints = useUmapPointsResource(() => umapRun()?.id);
  const [selectedId, setSelectedId] = createSignal<string | undefined>(
    undefined
  );
  // Panel fetches document internally

  // Stores
  const canvasStore = createCanvasStore();
  const [isMounted, setIsMounted] = createSignal(false);
  const [viewportW, setViewportW] = createSignal(0);
  const [viewportH, setViewportH] = createSignal(0);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [hoveredRegionId, setHoveredRegionId] = createSignal<
    string | undefined
  >(undefined);
  const [railHoveredDocId, setRailHoveredDocId] = createSignal<
    string | undefined
  >(undefined);
  const [pressedRegionId, setPressedRegionId] = createSignal<
    string | undefined
  >(undefined);
  const [selectedRegionId, setSelectedRegionId] = createSignal<
    string | undefined
  >(undefined);
  const [regionsOnly, setRegionsOnly] = createSignal(false);
  const [hasAutoFit, setHasAutoFit] = createSignal(false);
  const positionsStore = createPositionsStore({
    docs,
    umapRun,
    umapPoints,
    aspectRatio: () => {
      const w = viewportW();
      const h = Math.max(1, viewportH() - canvasStore.navHeight());
      return w > 0 && h > 0 ? w / h : 1;
    },
    searchQuery,
  });

  // Positions and transform via stores
  const positions = () => positionsStore.positions();
  const viewTransform = () => canvasStore.viewTransform();
  const scheduleTransform = () => canvasStore.scheduleTransform();
  const umapRegions = createMemo(() =>
    normalizeUmapRegions(umapPoints(), umapRun()?.regions, SPREAD)
  );

  // Selection store (brush + isolation)
  const selectionStore = createSelectionStore({
    getScale: canvasStore.scale,
    getOffset: canvasStore.offset,
    getPositions: positions,
  });

  function measureNav() {
    const nav = document.querySelector("main nav");
    const h = nav
      ? Math.round((nav as HTMLElement).getBoundingClientRect().height)
      : 0;
    canvasStore.setNavHeight(h);
  }

  function measureCanvasViewport() {
    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    }
    const rect = main.getBoundingClientRect();
    return {
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    };
  }

  function measureFullViewBounds() {
    const snapshot = umapRegions();
    if (snapshot && snapshot.regions.length > 0) {
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;

      for (const region of snapshot.regions) {
        minX = Math.min(minX, region.bounds.minX);
        minY = Math.min(minY, region.bounds.minY);
        maxX = Math.max(maxX, region.bounds.maxX);
        maxY = Math.max(maxY, region.bounds.maxY);
      }

      return {
        minX: minX - FULL_VIEW_PADDING,
        minY: minY - FULL_VIEW_PADDING,
        maxX: maxX + FULL_VIEW_PADDING,
        maxY: maxY + FULL_VIEW_PADDING,
      };
    }

    const positionMap = positions();
    if (positionMap.size > 0) {
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;

      for (const point of positionMap.values()) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }

      return {
        minX: minX - FULL_VIEW_PADDING,
        minY: minY - FULL_VIEW_PADDING,
        maxX: maxX + FULL_VIEW_PADDING,
        maxY: maxY + FULL_VIEW_PADDING,
      };
    }

    return {
      minX: -SPREAD,
      minY: -SPREAD,
      maxX: SPREAD,
      maxY: SPREAD,
    };
  }

  function fitToSpread() {
    if (!isBrowser) return;
    const viewport = measureCanvasViewport();
    const railInset = getRailInset(viewport.width);
    const availableWidth = Math.max(240, viewport.width - railInset);
    const availH = Math.max(100, viewport.height - canvasStore.navHeight());
    const bounds = measureFullViewBounds();
    const contentWidth = Math.max(240, bounds.maxX - bounds.minX);
    const contentHeight = Math.max(240, bounds.maxY - bounds.minY);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const targetScale = Math.max(
      0.2,
      Math.min(
        2,
        0.92 * Math.min(availableWidth / contentWidth, availH / contentHeight)
      )
    );
    canvasStore.animateToView({
      scale: targetScale,
      offset: {
        x: availableWidth / 2 - centerX * targetScale,
        y: availH / 2 - centerY * targetScale,
      },
      durationMs: 420,
    });
  }

  function clearSelectedRegion() {
    setSelectedRegionId(undefined);
    selectionStore.clearSelection();
  }

  function handleZoomToRegion(regionId: string) {
    const snapshot = umapRegions();
    if (!snapshot || typeof window === "undefined") return;
    const region = snapshot.regions.find((item) => item.id === regionId);
    if (!region) return;

    setRegionsOnly(false);
    setSelectedRegionId(region.id);
    selectionStore.setSelection(region.docIds);

    const viewport = measureCanvasViewport();
    const railInset = getRailInset(viewport.width);
    const viewportWidth = Math.max(240, viewport.width - railInset);
    const viewportHeight = Math.max(
      240,
      viewport.height - canvasStore.navHeight()
    );
    const regionWidth = Math.max(120, region.bounds.maxX - region.bounds.minX);
    const regionHeight = Math.max(120, region.bounds.maxY - region.bounds.minY);
    const fitScale = Math.min(
      (viewportWidth * 0.56) / regionWidth,
      (viewportHeight * 0.56) / regionHeight
    );
    const targetScale = Math.max(0.55, Math.min(2.8, fitScale));

    canvasStore.animateToView({
      scale: targetScale,
      offset: {
        x: viewportWidth / 2 - region.centroid.x * targetScale,
        y: viewportHeight / 2 - region.centroid.y * targetScale,
      },
    });
  }

  onMount(() => {
    setIsMounted(true);
    measureNav();
    const viewport = measureCanvasViewport();
    setViewportW(viewport.width);
    setViewportH(viewport.height);
    canvasStore.setOffset({
      x: viewport.width / 2,
      y: (viewport.height - canvasStore.navHeight()) / 2,
    });
    scheduleTransform();
    const handleResize = () => {
      measureNav();
      const nextViewport = measureCanvasViewport();
      setViewportW(nextViewport.width);
      setViewportH(nextViewport.height);
      scheduleTransform();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (
        event.key === "Escape" &&
        (selectedId() ||
          (typeof document !== "undefined" &&
            document.querySelector('[role="dialog"][aria-label="Document details"]')))
      ) {
        return;
      }
      if (event.key === "Escape") {
        if (!selectedRegionId()) return;
        event.preventDefault();
        clearSelectedRegion();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        clearSelectedRegion();
        fitToSpread();
        return;
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        if (selectedRegionId()) {
          clearSelectedRegion();
          setRegionsOnly(true);
          return;
        }
        setRegionsOnly((current) => !current);
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  createEffect(() => {
    const list = docs();
    if (list) {
      console.log(`[canvas] loaded ${list.length} notes`);
      const sample = list.slice(0, Math.min(5, list.length));
      console.log(
        "[canvas] sample positions",
        sample.map((d, i) => ({
          id: d.id,
          title: d.title,
          pos: seededPositionFor(d.title, i, SPREAD),
        }))
      );
      if (isBrowser && list.length > 0 && !hasAutoFit()) {
        fitToSpread();
        setHasAutoFit(true);
      }
    }
  });

  const selectedRegion = createMemo(() => {
    const regionId = selectedRegionId();
    const snapshot = umapRegions();
    if (!regionId || !snapshot) return null;
    return snapshot.regions.find((item) => item.id === regionId) ?? null;
  });

  const visibleDocs = createMemo<DocItem[]>(() => {
    const list: DocItem[] = (docs() || []) as DocItem[];
    const region = selectedRegion();
    if (region) {
      const docIds = new Set(region.docIds);
      return list.filter((doc: DocItem) => docIds.has(doc.id));
    }
    const iso = selectionStore.isolatedIdSet();
    if (!iso) return list;
    return list.filter((d: DocItem) => iso.has(d.id));
  });
  const visibleDocIds = createMemo(() => new Set(visibleDocs().map((d) => d.id)));
  const canHoverNotes = createMemo(
    () =>
      !regionsOnly() &&
      !!selectedRegionId() &&
      canvasStore.scale() >= 0.96
  );
  const visibleDocsSorted = createMemo(() =>
    visibleDocs()
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
  );

  // Hover derivations
  const hover = createHoverDerivations({
    positionsStore,
    canvasStore,
    docs,
    canHoverNotes,
    visibleDocIds: () => visibleDocIds(),
  });
  const panZoomHandlers = createPanZoomHandlers(canvasStore, {
    getCanOpen: hover.showHoverLabel,
    getHoveredId: hover.hoveredId,
    getHoveredRegionId: hoveredRegionId,
    getPressedRegionId: pressedRegionId,
    onOpenDoc: (id) => setSelectedId(id),
    onActivateRegion: handleZoomToRegion,
    clearPressedRegion: () => setPressedRegionId(undefined),
    selection: selectionStore,
  });

  return (
    <Box
      as="main"
      bg="bg.default"
      overflow="hidden"
      position="relative"
      minH="100vh"
      h="100vh"
      w="full"
    >
      <Show
        when={isMounted()}
        fallback={
          <Box
            position="absolute"
            inset="0"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize="sm" color="fg.muted">
              Loading canvas…
            </Text>
          </Box>
        }
      >
        <Suspense fallback={null}>
        <VisualCanvas
          docs={visibleDocs()}
          positions={positions}
          umapRegions={umapRegions}
          viewportWidth={() => Math.max(1, viewportW() - getRailInset(viewportW()))}
          viewportHeight={() =>
            Math.max(1, viewportH() - canvasStore.navHeight())
          }
          hoveredId={hover.hoveredId}
          railHoveredId={railHoveredDocId}
          viewTransform={viewTransform}
          offset={canvasStore.offset}
          navHeight={canvasStore.navHeight}
          scale={canvasStore.scale}
          searchQuery={searchQuery}
          eventHandlers={panZoomHandlers}
          hoveredRegionId={hoveredRegionId}
          onHoveredRegionChange={setHoveredRegionId}
          onPressedRegionChange={setPressedRegionId}
          suppressNextOpen={panZoomHandlers.blockNextOpen}
          onSelectDoc={(id) => setSelectedId(id)}
          onHoveredDocChange={setRailHoveredDocId}
          onZoomToRegion={handleZoomToRegion}
          selectedRegionId={selectedRegionId}
          regionsOnly={regionsOnly}
          selection={selectionStore}
        />
        </Suspense>
        <DocumentSidePanel
          open={!!selectedId()}
          docId={selectedId()}
          onClose={(shouldRefetch) => {
            if (shouldRefetch) {
              refetchDocs();
            }
            setSelectedId(undefined);
          }}
        />
        <Suspense fallback={null}>
          <ControlPanel
            navHeight={canvasStore.navHeight}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        </Suspense>
        <CanvasSideRail
          navHeight={canvasStore.navHeight}
          regions={() => umapRegions()?.regions ?? []}
          selectedRegion={selectedRegion}
          visibleDocs={visibleDocsSorted}
          searchQuery={searchQuery}
          hoveredRegionId={hoveredRegionId}
          selectedDocId={selectedId}
          onHoveredRegionChange={setHoveredRegionId}
          onHoveredDocChange={setRailHoveredDocId}
          onZoomToRegion={handleZoomToRegion}
          onClearRegion={clearSelectedRegion}
          onOpenDoc={(id) => setSelectedId(id)}
        />
      </Show>
    </Box>
  );
};

export default CanvasRoute;
