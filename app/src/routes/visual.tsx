import {
  type VoidComponent,
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import DocumentSidePanel from "../components/DocumentSidePanel";
import { VisualCanvas } from "~/components/visual/VisualCanvas";
import { ControlPanel } from "~/components/visual/ControlPanel";
import {
  useDocsResource,
  useUmapPointsResource,
  useUmapRunResource,
} from "~/services/docs.resources";
import { colorFor } from "~/utils/colors";
import { seededPositionFor } from "~/layout/seeded";
import { createPanZoomHandlers } from "~/hooks/usePanZoom";
import { createHoverDerivations } from "~/hooks/useHover";
import { createCanvasStore } from "~/stores/canvas.store";
import { createPositionsStore } from "~/stores/positions.store";
// DocumentSidePanel will load the full document on demand

const SPREAD = 1000;
const isBrowser = typeof window !== "undefined";

// data & layout helpers moved to services/utils/layout modules

// seededPositionFor, colorFor now imported

const VisualRoute: VoidComponent = () => {
  const [docs, { refetch: refetchDocs }] = useDocsResource();
  const [umapRun, { refetch: refetchUmapRun }] = useUmapRunResource();
  // Refetch points whenever the latest run id changes to avoid stale data after client navigation
  const [umapPoints, { refetch: refetchUmapPoints }] = useUmapPointsResource(
    () => umapRun()?.id
  );
  const [selectedId, setSelectedId] = createSignal<string | undefined>(
    undefined
  );
  // Panel fetches document internally

  // Stores
  const canvasStore = createCanvasStore();
  const positionsStore = createPositionsStore({
    docs,
    umapRun,
    umapPoints,
    useUmap: canvasStore.useUmap,
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
    canvasStore.setOffset({
      x: vw / 2,
      y: canvasStore.navHeight() + (vh - canvasStore.navHeight()) / 2,
    });
    scheduleTransform();
    window.addEventListener("resize", () => {
      measureNav();
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

  // Log UMAP run and points loaded
  createEffect(() => {
    const run = umapRun();
    if (run) {
      console.log(`[visual] UMAP run loaded id=${run.id} dims=${run.dims}`);
    }
  });

  createEffect(() => {
    const pts = umapPoints();
    if (pts) {
      console.log(`[visual] UMAP points loaded: ${pts.length}`);
    }
  });

  // Log coordinate source summary
  createEffect(() => {
    const list = docs();
    if (!list) return;
    const index = positionsStore.umapIndex();
    let usedUmap = 0;
    let usedSeed = 0;
    for (const d of list) {
      if (canvasStore.useUmap() && index.has(d.id)) usedUmap++;
      else usedSeed++;
    }
    const sample = list.slice(0, Math.min(10, list.length)).map((d, i) => {
      const fromUmap = canvasStore.useUmap() ? index.get(d.id) : undefined;
      return {
        id: d.id,
        title: d.title,
        source: fromUmap ? "umap" : "seed",
        pos: fromUmap ?? seededPositionFor(d.title, i, SPREAD),
      };
    });
    console.log(
      `[visual] coordinate sources → umap=${usedUmap}, seeded=${usedSeed} (sample below)`
    );
    console.log(sample);
  });

  onCleanup(() => {
    if (isBrowser) {
      window.removeEventListener("resize", scheduleTransform);
    }
  });

  // Hover values
  const hoveredDocId = () => hover.hoveredId();
  const hoveredLabelScreen = () => hover.hoveredLabelScreen();
  const showHoverLabel = () => hover.showHoverLabel();

  // Nudge handled by positions store (placeholder in Step 4)

  // ---------- Left list pane: search and sorting ----------
  const [searchQuery, setSearchQuery] = createSignal("");
  const [sortMode, setSortMode] = createSignal<"proximity" | "title" | "date">(
    "proximity"
  );

  const filteredAndSortedDocs = createMemo(() => {
    const list = docs() || [];
    const q = searchQuery().trim().toLowerCase();
    const pos = positions();
    const m = hover.mouseWorld();
    const sMode = sortMode();
    const filtered = q
      ? list.filter((d) => d.title.toLowerCase().includes(q))
      : list.slice();
    if (sMode === "title") {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sMode === "date") {
      filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    } else {
      // proximity (default)
      function d2(id: string) {
        const p = pos.get(id);
        if (!p) return Number.POSITIVE_INFINITY;
        const dx = p.x - m.x;
        const dy = p.y - m.y;
        return dx * dx + dy * dy;
      }
      filtered.sort((a, b) => d2(a.id) - d2(b.id));
    }
    return filtered;
  });

  return (
    <main class="min-h-screen bg-white">
      <VisualCanvas
        docs={docs}
        positions={positions}
        hoveredId={hover.hoveredId}
        hoveredLabelScreen={hover.hoveredLabelScreen}
        showHoverLabel={hover.showHoverLabel}
        viewTransform={viewTransform}
        navHeight={canvasStore.navHeight}
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
        docs={docs}
        positions={positions}
        mouseWorld={hover.mouseWorld}
        hoveredId={hover.hoveredId}
        showHoverLabel={hover.showHoverLabel}
        navHeight={canvasStore.navHeight}
        scale={canvasStore.scale}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortMode={sortMode}
        setSortMode={(m) => setSortMode(m)}
        nudging={positionsStore.nudging}
        onNudge={positionsStore.runNudge}
        onSelectDoc={(id) => setSelectedId(id)}
      />
    </main>
  );
};

export default VisualRoute;
