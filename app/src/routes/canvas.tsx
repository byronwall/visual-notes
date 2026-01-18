import {
  type VoidComponent,
  createEffect,
  createSignal,
  createMemo,
  onCleanup,
  onMount,
  createResource,
  Suspense,
} from "solid-js";
import { Box } from "styled-system/jsx";
import { ControlPanel } from "~/components/visual/ControlPanel";
import { VisualCanvas } from "~/components/visual/VisualCanvas";
import { createHoverDerivations } from "~/hooks/useHover";
import { createPanZoomHandlers } from "~/hooks/usePanZoom";
import { seededPositionFor } from "~/layout/seeded";
import {
  useUmapPointsResource,
  useUmapRunResource,
} from "~/services/docs.resources";
import { fetchDocs as fetchFilteredDocs } from "~/features/docs-index/data/docs.service";
import { createCanvasStore } from "~/stores/canvas.store";
import { createPositionsStore } from "~/stores/positions.store";
import { createSelectionStore } from "~/stores/selection.store";
import { DocumentSidePanel } from "~/components/DocumentSidePanel";
import type { DocItem } from "~/types/notes";

const SPREAD = 1000;
const isBrowser = typeof window !== "undefined";

const CanvasRoute: VoidComponent = () => {
  // Filters for server-backed docs fetch (path + meta)
  const [pathPrefix, setPathPrefix] = createSignal("");
  const [blankPathOnly, setBlankPathOnly] = createSignal(false);
  const [metaKey, setMetaKey] = createSignal("");
  const [metaValue, setMetaValue] = createSignal("");

  const [docs, { refetch: refetchDocs }] = createResource(
    () => ({
      p: pathPrefix(),
      b: blankPathOnly(),
      k: metaKey(),
      v: metaValue(),
    }),
    (s) =>
      fetchFilteredDocs({
        pathPrefix: s.p || undefined,
        pathBlankOnly: s.b || undefined,
        metaKey: s.k || undefined,
        metaValue: s.v || undefined,
      })
  );
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
  const [nestByPath, setNestByPath] = createSignal(false);
  const positionsStore = createPositionsStore({
    docs,
    umapRun,
    umapPoints,
    useUmap: canvasStore.useUmap,
    layoutMode: canvasStore.layoutMode,
    clusterUnknownTopCenter: canvasStore.clusterUnknownTopCenter,
    aspectRatio: () => {
      const w = viewportW();
      const h = Math.max(1, viewportH() - canvasStore.navHeight());
      return w > 0 && h > 0 ? w / h : 1;
    },
    searchQuery,
    hideNonMatches,
    nestByPath,
  });

  // Hover derivations
  const hover = createHoverDerivations({ positionsStore, canvasStore, docs });

  // Positions and transform via stores
  const positions = () => positionsStore.positions();
  const viewTransform = () => canvasStore.viewTransform();
  const scheduleTransform = () => canvasStore.scheduleTransform();
  const umapIndex = () => positionsStore.umapIndex();

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
    onOpenDoc: (id) => setSelectedId(id),
    selection: selectionStore,
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

  // Recenter when layout mode changes
  createEffect(() => {
    const mode = canvasStore.layoutMode();
    console.log(`[canvas] layout mode: ${mode}`);
    if (isBrowser) {
      fitToSpread();
    }
  });

  // ---------- Left list pane: search and sorting ----------
  const [sortMode, setSortMode] = createSignal<"proximity" | "title" | "date">(
    "proximity"
  );

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
      style={{
        position: "fixed",
        left: "0",
        right: "0",
        top: `${canvasStore.navHeight()}px`,
        bottom: "0",
      }}
    >
      <Suspense fallback={null}>
        <VisualCanvas
          docs={isolatedDocs()}
          positions={positions}
          umapIndex={umapIndex}
          hoveredId={hover.hoveredId}
          hoveredLabelScreen={hover.hoveredLabelScreen}
          showHoverLabel={hover.showHoverLabel}
          viewTransform={viewTransform}
          navHeight={canvasStore.navHeight}
          scale={canvasStore.scale}
          searchQuery={searchQuery}
          hideNonMatches={hideNonMatches}
          layoutMode={canvasStore.layoutMode}
          nestByPath={nestByPath}
          eventHandlers={panZoomHandlers}
          onSelectDoc={(id) => setSelectedId(id)}
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
          docs={isolatedDocs()}
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
          clusterUnknownTopCenter={canvasStore.clusterUnknownTopCenter}
          setClusterUnknownTopCenter={(v) =>
            canvasStore.setClusterUnknownTopCenter(v)
          }
          nestByPath={nestByPath}
          setNestByPath={setNestByPath}
          selection={selectionStore}
          pathPrefix={pathPrefix}
          setPathPrefix={setPathPrefix}
          blankPathOnly={blankPathOnly}
          setBlankPathOnly={setBlankPathOnly}
          metaKey={metaKey}
          setMetaKey={setMetaKey}
          metaValue={metaValue}
          setMetaValue={setMetaValue}
        />
      </Suspense>
    </Box>
  );
};

export default CanvasRoute;
