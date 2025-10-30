import {
  type VoidComponent,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { ControlPanel } from "~/components/visual/ControlPanel";
import { VisualCanvas } from "~/components/visual/VisualCanvas";
import { createHoverDerivations } from "~/hooks/useHover";
import { createPanZoomHandlers } from "~/hooks/usePanZoom";
import { seededPositionFor } from "~/layout/seeded";
import {
  useDocsResource,
  useUmapPointsResource,
  useUmapRunResource,
} from "~/services/docs.resources";
import { createCanvasStore } from "~/stores/canvas.store";
import { createPositionsStore } from "~/stores/positions.store";
import DocumentSidePanel from "../components/DocumentSidePanel";

const SPREAD = 1000;
const isBrowser = typeof window !== "undefined";

const VisualRoute: VoidComponent = () => {
  const [docs, { refetch: refetchDocs }] = useDocsResource();
  const [umapRun] = useUmapRunResource();
  // Refetch points whenever the latest run id changes to avoid stale data after client navigation
  const [umapPoints] = useUmapPointsResource(() => umapRun()?.id);
  const [selectedId, setSelectedId] = createSignal<string | undefined>(
    undefined
  );
  // Panel fetches document internally

  // Stores
  const canvasStore = createCanvasStore();
  const [viewportW, setViewportW] = createSignal(0);
  const [viewportH, setViewportH] = createSignal(0);
  // Search/filter state used by layout and UI
  const [searchQuery, setSearchQuery] = createSignal("");
  const [hideNonMatches, setHideNonMatches] = createSignal(true);
  const positionsStore = createPositionsStore({
    docs,
    umapRun,
    umapPoints,
    useUmap: canvasStore.useUmap,
    layoutMode: canvasStore.layoutMode,
    aspectRatio: () => {
      const w = viewportW();
      const h = Math.max(1, viewportH() - canvasStore.navHeight());
      return w > 0 && h > 0 ? w / h : 1;
    },
    searchQuery,
    hideNonMatches,
  });

  // Hover derivations
  const hover = createHoverDerivations({ positionsStore, canvasStore, docs });

  // Positions and transform via stores
  const positions = () => positionsStore.positions();
  const viewTransform = () => canvasStore.viewTransform();
  const scheduleTransform = () => canvasStore.scheduleTransform();

  // Pan/zoom handlers
  const panZoomHandlers = createPanZoomHandlers(canvasStore, {
    getCanOpen: hover.showHoverLabel,
    getHoveredId: hover.hoveredId,
    onOpenDoc: (id) => setSelectedId(id),
  });

  function measureNav() {
    const nav = document.querySelector("nav");
    const h = nav
      ? Math.round((nav as HTMLElement).getBoundingClientRect().height)
      : 56;
    canvasStore.setNavHeight(h);
  }

  function fitToSpread() {
    canvasStore.fitToSpread(SPREAD);
  }

  onMount(() => {
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
      console.log(`[visual] loaded ${list.length} notes`);
      const sample = list.slice(0, Math.min(5, list.length));
      console.log(
        "[visual] sample positions",
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

  // Recenter when layout mode changes
  createEffect(() => {
    const mode = canvasStore.layoutMode();
    console.log(`[visual] layout mode: ${mode}`);
    if (isBrowser) {
      fitToSpread();
    }
  });

  // ---------- Left list pane: search and sorting ----------
  const [sortMode, setSortMode] = createSignal<"proximity" | "title" | "date">(
    "proximity"
  );

  return (
    <main class="min-h-screen bg-white">
      <VisualCanvas
        docs={docs.latest}
        positions={positions}
        hoveredId={hover.hoveredId}
        hoveredLabelScreen={hover.hoveredLabelScreen}
        showHoverLabel={hover.showHoverLabel}
        viewTransform={viewTransform}
        navHeight={canvasStore.navHeight}
        searchQuery={searchQuery}
        hideNonMatches={hideNonMatches}
        eventHandlers={panZoomHandlers}
        onSelectDoc={(id) => setSelectedId(id)}
      />
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
      <ControlPanel
        docs={docs.latest}
        positions={positions}
        mouseWorld={hover.mouseWorld}
        hoveredId={hover.hoveredId}
        showHoverLabel={hover.showHoverLabel}
        navHeight={canvasStore.navHeight}
        scale={canvasStore.scale}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        hideNonMatches={hideNonMatches}
        setHideNonMatches={setHideNonMatches}
        sortMode={sortMode}
        setSortMode={(m) => setSortMode(m)}
        nudging={positionsStore.nudging}
        onNudge={positionsStore.runNudge}
        onSelectDoc={(id) => setSelectedId(id)}
        layoutMode={canvasStore.layoutMode}
        setLayoutMode={(m) => canvasStore.setLayoutMode(m)}
      />
    </main>
  );
};

export default VisualRoute;
