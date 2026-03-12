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
  const [pressedRegionId, setPressedRegionId] = createSignal<
    string | undefined
  >(undefined);
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

  // Hover derivations
  const hover = createHoverDerivations({ positionsStore, canvasStore, docs });

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

  // Pan/zoom handlers
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

  function measureNav() {
    const nav = document.querySelector("main nav");
    const h = nav
      ? Math.round((nav as HTMLElement).getBoundingClientRect().height)
      : 0;
    canvasStore.setNavHeight(h);
  }

  function fitToSpread() {
    canvasStore.fitToSpread(SPREAD);
  }

  function handleZoomToRegion(regionId: string) {
    const snapshot = umapRegions();
    if (!snapshot || typeof window === "undefined") return;
    const region = snapshot.regions.find((item) => item.id === regionId);
    if (!region) return;

    const nav = canvasStore.navHeight();
    const viewportWidth = window.innerWidth;
    const viewportHeight = Math.max(240, window.innerHeight - nav);
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
        y: nav + viewportHeight / 2 - region.centroid.y * targetScale,
      },
    });
  }

  onMount(() => {
    setIsMounted(true);
    measureNav();
    // Center the origin initially under navbar
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setViewportW(vw);
    setViewportH(vh);
    canvasStore.setOffset({
      x: vw / 2,
      y: canvasStore.navHeight() + (vh - canvasStore.navHeight()) / 2,
    });
    scheduleTransform();
    window.addEventListener("resize", () => {
      measureNav();
      setViewportW(window.innerWidth);
      setViewportH(window.innerHeight);
      scheduleTransform();
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
      if (isBrowser && list.length > 0) fitToSpread();
    }
  });

  onCleanup(() => {
    if (isBrowser) {
      window.removeEventListener("resize", scheduleTransform);
    }
  });

  const isolatedDocs = createMemo<DocItem[]>(() => {
    const list: DocItem[] = (docs() || []) as DocItem[];
    const iso = selectionStore.isolatedIdSet();
    if (!iso) return list;
    return list.filter((d: DocItem) => iso.has(d.id));
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
          docs={isolatedDocs()}
          positions={positions}
          umapRegions={umapRegions}
          hoveredId={hover.hoveredId}
          hoveredLabelScreen={hover.hoveredLabelScreen}
          showHoverLabel={hover.showHoverLabel}
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
          onZoomToRegion={handleZoomToRegion}
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
      </Show>
    </Box>
  );
};

export default CanvasRoute;
