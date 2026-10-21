import { useSearchParams } from "@solidjs/router";
import { ListIcon, XIcon } from "lucide-solid";
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
  untrack,
} from "solid-js";
import { Box } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import { ControlPanel } from "~/components/visual/ControlPanel";
import { CanvasZoomControls } from "~/components/visual/CanvasZoomControls";
import {
  CANVAS_SIDE_RAIL_WIDTH_PX,
  CanvasSideRail,
  type CanvasRailMode,
} from "~/components/visual/CanvasSideRail";
import { VisualCanvas } from "~/components/visual/VisualCanvas";
import {
  boundsOfPoints,
  fitBoundsView,
  unionBounds,
  type CanvasViewport,
} from "~/components/visual/canvas-view";
import {
  docMatchesCanvasQuery,
  normalizeCanvasQuery,
} from "~/components/visual/canvas-search";
import { useCanvasKeyboard } from "~/components/visual/useCanvasKeyboard";
import { createHoverDerivations } from "~/hooks/useHover";
import { createPanZoomHandlers } from "~/hooks/usePanZoom";
import { normalizeUmapRegions } from "~/layout/umap-normalize";
import { resolveUmapRegionId } from "~/features/umap/region-types";
import {
  useUmapPointsResource,
  useUmapRunResource,
} from "~/services/docs.resources";
import { fetchDocs } from "~/features/docs-index/data/docs.service";
import { createCanvasStore } from "~/stores/canvas.store";
import { createPositionsStore } from "~/stores/positions.store";
import { createSelectionStore } from "~/stores/selection.store";
import { DocumentSidePanel } from "~/components/DocumentSidePanel";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import type { DocumentEditorApi } from "~/components/DocumentEditor";
import type { DocItem } from "~/types/notes";

const SPREAD = 1000;
const isBrowser = typeof window !== "undefined";
const FULL_VIEW_PADDING = 120;
// Matches Panda's `md` breakpoint, where the rail docks beside the map.
const DESKTOP_RAIL_BREAKPOINT = 768;
const RAIL_GUTTER_PX = 24;
const PANEL_MAX_WIDTH_PX = 520;
const PANEL_WIDTH = `min(94vw, ${PANEL_MAX_WIDTH_PX}px)`;

function panelWidthPx(viewportWidth: number) {
  return Math.min(viewportWidth * 0.94, PANEL_MAX_WIDTH_PX);
}

const CanvasRoute: VoidComponent = () => {
  const [searchParams, setSearchParams] = useSearchParams<{
    region?: string;
    doc?: string;
  }>();
  const [docs, { refetch: refetchDocs }] = createResource(
    () => true,
    () => fetchDocs({})
  );
  // Reading an errored resource throws; the canvas shows its own error state.
  const loadedDocs = () =>
    docs.state === "errored" ? undefined : (docs.latest as DocItem[] | undefined);
  const umapRun = useUmapRunResource();
  // Refetch points whenever the latest run id changes to avoid stale data after client navigation
  const umapPoints = useUmapPointsResource(() => umapRun()?.id);
  const [selectedId, setSelectedId] = createSignal<string | undefined>(
    untrack(() => searchParams.doc) || undefined
  );
  const [activeEditor, setActiveEditor] = createSignal<{
    docId: string;
    api: DocumentEditorApi;
  }>();
  const [pendingSelectedId, setPendingSelectedId] = createSignal<
    string | undefined
  >();
  const [discardDialogOpen, setDiscardDialogOpen] = createSignal(false);
  const [saveInProgressDialogOpen, setSaveInProgressDialogOpen] =
    createSignal(false);

  const requestSelectedId = (nextId: string | undefined) => {
    if (nextId === selectedId()) return;
    const currentEditor = activeEditor();
    if (currentEditor && currentEditor.docId === selectedId()) {
      if (currentEditor.api.saving()) {
        setSaveInProgressDialogOpen(true);
        return;
      }
      if (currentEditor.api.dirty()) {
        setPendingSelectedId(nextId);
        setDiscardDialogOpen(true);
        return;
      }
    }
    setSelectedId(nextId);
  };

  const handleEditorApiChange = (docId: string, api?: DocumentEditorApi) => {
    if (api) {
      setActiveEditor({ docId, api });
      return;
    }
    setActiveEditor((current) =>
      current?.docId === docId ? undefined : current,
    );
  };

  createEffect(() => {
    if (!saveInProgressDialogOpen()) return;
    const currentEditor = activeEditor();
    if (!currentEditor || !currentEditor.api.saving()) {
      setSaveInProgressDialogOpen(false);
    }
  });

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
  >(untrack(() => searchParams.region) || undefined);
  const [regionsOnly, setRegionsOnly] = createSignal(false);
  const [mobileRailOpen, setMobileRailOpen] = createSignal(false);
  const [coarsePointer, setCoarsePointer] = createSignal(false);
  let userMovedView = false;
  let searchInput: HTMLInputElement | undefined;

  const positionsStore = createPositionsStore({
    docs: loadedDocs,
    umapRun,
    umapPoints,
    aspectRatio: () => {
      const w = viewportW();
      const h = Math.max(1, viewportH() - canvasStore.navHeight());
      return w > 0 && h > 0 ? w / h : 1;
    },
    searchQuery,
  });

  const positions = () => positionsStore.positions();
  const viewTransform = () => canvasStore.viewTransform();
  const umapRegions = createMemo(() =>
    normalizeUmapRegions(umapPoints(), umapRun()?.regions, SPREAD)
  );
  const regionList = createMemo(() => umapRegions()?.regions ?? []);
  const hasRegions = createMemo(() => regionList().length > 0);
  const selectedRegion = createMemo(() => {
    const regionId = selectedRegionId();
    if (!regionId) return null;
    return regionList().find((item) => item.id === regionId) ?? null;
  });


  // Selection store (brush + isolation)
  const selectionStore = createSelectionStore({
    getScale: canvasStore.scale,
    getOffset: canvasStore.offset,
    getPositions: positions,
  });

  // Keep the open region and note in the URL so a refresh lands in the same place.
  createEffect(() => {
    const region = selectedRegionId();
    const doc = selectedId();
    untrack(() => {
      if (
        (searchParams.region || undefined) === region &&
        (searchParams.doc || undefined) === doc
      ) {
        return;
      }
      setSearchParams({ region, doc }, { replace: true, scroll: false });
    });
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
      return { width: window.innerWidth, height: window.innerHeight };
    }
    const rect = main.getBoundingClientRect();
    return {
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    };
  }

  /** Width covered on the right by the docked rail or the open note panel. */
  function rightInset(viewportWidth: number) {
    if (selectedId()) return panelWidthPx(viewportWidth);
    if (viewportWidth < DESKTOP_RAIL_BREAKPOINT) return 0;
    return CANVAS_SIDE_RAIL_WIDTH_PX + RAIL_GUTTER_PX;
  }

  /** The unobstructed part of the canvas used for fitting and centering. */
  function availableViewport(): CanvasViewport {
    const viewport = measureCanvasViewport();
    return {
      width: Math.max(240, viewport.width - rightInset(viewport.width)),
      height: Math.max(100, viewport.height - canvasStore.navHeight()),
    };
  }

  function measureFullViewBounds() {
    const regionBounds = unionBounds(regionList().map((region) => region.bounds));
    if (regionBounds) {
      return {
        minX: regionBounds.minX - FULL_VIEW_PADDING,
        minY: regionBounds.minY - FULL_VIEW_PADDING,
        maxX: regionBounds.maxX + FULL_VIEW_PADDING,
        maxY: regionBounds.maxY + FULL_VIEW_PADDING,
      };
    }
    return (
      boundsOfPoints(positions().values(), FULL_VIEW_PADDING) ?? {
        minX: -SPREAD,
        minY: -SPREAD,
        maxX: SPREAD,
        maxY: SPREAD,
      }
    );
  }

  function fitToSpread() {
    if (!isBrowser) return;
    canvasStore.animateToView({
      ...fitBoundsView(measureFullViewBounds(), availableViewport()),
      durationMs: 420,
    });
  }

  function viewportCenter() {
    const viewport = availableViewport();
    return { x: viewport.width / 2, y: viewport.height / 2 };
  }

  function clearSelectedRegion() {
    setSelectedRegionId(undefined);
    selectionStore.clearSelection();
  }

  function handleZoomToRegion(regionId: string) {
    const region = regionList().find((item) => item.id === regionId);
    if (!region || !isBrowser) return;

    setRegionsOnly(false);
    setSelectedRegionId(region.id);
    selectionStore.setSelection(region.docIds);
    setMobileRailOpen(false);

    const viewport = availableViewport();
    const regionWidth = Math.max(120, region.bounds.maxX - region.bounds.minX);
    const regionHeight = Math.max(120, region.bounds.maxY - region.bounds.minY);
    const fitScale = Math.min(
      (viewport.width * 0.56) / regionWidth,
      (viewport.height * 0.56) / regionHeight
    );
    const targetScale = Math.max(0.55, Math.min(2.8, fitScale));

    canvasStore.animateToView({
      scale: targetScale,
      offset: {
        x: viewport.width / 2 - region.centroid.x * targetScale,
        y: viewport.height / 2 - region.centroid.y * targetScale,
      },
    });
  }

  const visibleDocs = createMemo<DocItem[]>(() => {
    const list: DocItem[] = loadedDocs() ?? [];
    const region = selectedRegion();
    if (region) {
      const docIds = new Set(region.docIds);
      return list.filter((doc: DocItem) => docIds.has(doc.id));
    }
    const iso = selectionStore.isolatedIdSet();
    if (!iso) return list;
    return list.filter((d: DocItem) => iso.has(d.id));
  });

  const normalizedQuery = createMemo(() => normalizeCanvasQuery(searchQuery()));
  const matchingDocs = createMemo(() => {
    const q = normalizedQuery();
    if (!q) return null;
    return visibleDocs().filter((doc) => docMatchesCanvasQuery(doc, q));
  });
  const matchingDocIds = createMemo(() => {
    const matches = matchingDocs();
    return matches ? new Set(matches.map((doc) => doc.id)) : null;
  });

  function fitToMatches() {
    const matches = matchingDocs();
    if (!matches || matches.length === 0) return;
    if (matches.length === 1) {
      requestSelectedId(matches[0]!.id);
      return;
    }
    const map = positions();
    const bounds = boundsOfPoints(
      matches.flatMap((doc) => {
        const pos = map.get(doc.id);
        return pos ? [pos] : [];
      }),
      40
    );
    if (!bounds) return;
    userMovedView = true;
    canvasStore.animateToView({
      ...fitBoundsView(bounds, availableViewport(), { fill: 0.8, maxScale: 3 }),
      durationMs: 360,
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
    const coarseQuery = window.matchMedia?.("(pointer: coarse)");
    setCoarsePointer(!!coarseQuery?.matches);
    const handleResize = () => {
      measureNav();
      const nextViewport = measureCanvasViewport();
      setViewportW(nextViewport.width);
      setViewportH(nextViewport.height);
    };
    window.addEventListener("resize", handleResize);
    onCleanup(() => window.removeEventListener("resize", handleResize));
  });

  useCanvasKeyboard({
    focusSearch: () => searchInput?.focus(),
    fit: () => {
      clearSelectedRegion();
      fitToSpread();
    },
    zoomBy: (factor) => {
      userMovedView = true;
      canvasStore.animateZoomAt(viewportCenter(), factor);
    },
    resetZoom: () => {
      userMovedView = true;
      canvasStore.animateZoomAt(viewportCenter(), 1 / canvasStore.scale());
    },
    panBy: (dx, dy) => {
      userMovedView = true;
      const t = canvasStore.offset();
      canvasStore.animateToView({
        scale: canvasStore.scale(),
        offset: { x: t.x + dx, y: t.y + dy },
        durationMs: 140,
      });
    },
    toggleRegionsOnly: () => {
      if (!hasRegions()) return;
      if (selectedRegionId()) {
        clearSelectedRegion();
        setRegionsOnly(true);
        return;
      }
      setRegionsOnly((current) => !current);
    },
    escape: () => {
      // The open note panel handles Escape itself.
      if (selectedId()) return false;
      if (searchQuery()) {
        setSearchQuery("");
        return true;
      }
      if (selectedRegionId()) {
        clearSelectedRegion();
        return true;
      }
      return false;
    },
  });

  // Drop a region or note from the URL once we know it no longer exists. A
  // region retired by a merge or retrain follows its redirect instead.
  createEffect(() => {
    const regionId = selectedRegionId();
    if (regionId && umapRegions() && !selectedRegion()) {
      setSelectedRegionId(
        resolveUmapRegionId(umapRun()?.regions, regionId) ?? undefined
      );
    }
  });
  createEffect(() => {
    const docId = selectedId();
    const list = loadedDocs();
    if (docId && list && !list.some((doc) => doc.id === docId)) {
      setSelectedId(undefined);
    }
  });

  // Fit once notes arrive, then again when regions load, unless the user has
  // already moved the view. A region from the URL wins over the full fit.
  let initialRegionApplied = false;
  createEffect(() => {
    const list = loadedDocs();
    const snapshot = umapRegions();
    if (!isMounted() || !list || list.length === 0) return;
    untrack(() => {
      const regionId = selectedRegionId();
      if (!initialRegionApplied && regionId && snapshot) {
        initialRegionApplied = true;
        userMovedView = true;
        handleZoomToRegion(regionId);
        return;
      }
      if (userMovedView) return;
      fitToSpread();
    });
  });

  const notesInteractive = createMemo(
    () =>
      !regionsOnly() &&
      (!hasRegions() ||
        !!selectedRegionId() ||
        !!matchingDocIds() ||
        canvasStore.scale() >= 0.9)
  );

  const railMode = createMemo<CanvasRailMode>(() => {
    if (selectedRegion()) return "region";
    if (matchingDocIds()) return "matches";
    if (!hasRegions()) return "notes";
    return "regions";
  });
  const railDocs = createMemo(() => {
    const mode = railMode();
    if (mode === "regions") return [] as DocItem[];
    if (mode === "notes") {
      return visibleDocs()
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return (matchingDocs() ?? visibleDocs())
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title));
  });

  // Hover derivations
  const hover = createHoverDerivations({
    positionsStore,
    canvasStore,
    docs: loadedDocs,
    canHoverNotes: notesInteractive,
    candidateDocs: () => matchingDocs() ?? visibleDocs(),
    coarsePointer,
  });
  const panZoomHandlers = createPanZoomHandlers(canvasStore, {
    getCanOpen: hover.showHoverLabel,
    getHoveredId: hover.hoveredId,
    getHoveredRegionId: hoveredRegionId,
    getPressedRegionId: pressedRegionId,
    onOpenDoc: requestSelectedId,
    onActivateRegion: handleZoomToRegion,
    clearPressedRegion: () => setPressedRegionId(undefined),
    selection: selectionStore,
    inertia: true,
  });
  const canvasEventHandlers = {
    ...panZoomHandlers,
    onWheel: (e: WheelEvent) => {
      userMovedView = true;
      panZoomHandlers.onWheel(e);
    },
    onPointerDown: (e: PointerEvent) => {
      userMovedView = true;
      panZoomHandlers.onPointerDown(e);
    },
  };

  // Bring a note opened from the rail or search into view beside the panel.
  createEffect(() => {
    const id = selectedId();
    if (!id || !isMounted()) return;
    untrack(() => {
      const pos = positions().get(id);
      if (!pos) return;
      const viewport = availableViewport();
      const s = canvasStore.scale();
      const t = canvasStore.offset();
      const sx = pos.x * s + t.x;
      const sy = pos.y * s + t.y;
      const margin = 48;
      if (
        sx >= margin &&
        sx <= viewport.width - margin &&
        sy >= margin &&
        sy <= viewport.height - margin
      ) {
        return;
      }
      canvasStore.animateToView({
        scale: s,
        offset: {
          x: viewport.width / 2 - pos.x * s,
          y: viewport.height / 2 - pos.y * s,
        },
        durationMs: 320,
      });
    });
  });

  const overlayTop = () => `calc(${canvasStore.navHeight()}px + 12px)`;

  return (
    <Box
      as="main"
      bg="bg.default"
      overflow="hidden"
      position="relative"
      // The phone shell reserves 4rem above the page for its menu button.
      h={{ base: "calc(100dvh - 4rem)", md: "100dvh" }}
      w="full"
    >
      {/* The canvas depends on viewport geometry and on note
          data that resolves differently on server and client, so it mounts on
          the client. SSR-ing the floating chrome caused a hydration mismatch. */}
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
        <Box position="absolute" zIndex="10" left="3" style={{ top: overlayTop() }}>
          <ControlPanel
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            matchCount={() => matchingDocs()?.length ?? 0}
            totalCount={() => visibleDocs().length}
            onSubmitSearch={fitToMatches}
            inputRef={(el) => (searchInput = el)}
          />
        </Box>

        <Box position="absolute" zIndex="10" left="3" bottom="3">
          <CanvasZoomControls
            scale={canvasStore.scale}
            onZoomIn={() => {
              userMovedView = true;
              canvasStore.animateZoomAt(viewportCenter(), 1.4);
            }}
            onZoomOut={() => {
              userMovedView = true;
              canvasStore.animateZoomAt(viewportCenter(), 1 / 1.4);
            }}
            onResetZoom={() => {
              userMovedView = true;
              canvasStore.animateZoomAt(
                viewportCenter(),
                1 / canvasStore.scale()
              );
            }}
            onFit={() => {
              clearSelectedRegion();
              fitToSpread();
            }}
          />
        </Box>

        <Box
          as="button"
          aria-label={mobileRailOpen() ? "Hide list" : "Show list"}
          aria-expanded={mobileRailOpen()}
          position="absolute"
          zIndex="12"
          right="3"
          display={{ base: "inline-flex", md: "none" }}
          alignItems="center"
          justifyContent="center"
          boxSize="10"
          bg="bg.default"
          borderRadius="l2"
          boxShadow="md"
          color="fg.default"
          cursor="pointer"
          focusVisibleRing="outside"
          transitionProperty="background-color"
          transitionDuration="fast"
          _hover={{ bg: "bg.subtle" }}
          style={{ top: overlayTop() }}
          onClick={() => setMobileRailOpen((open) => !open)}
        >
          <Show when={mobileRailOpen()} fallback={<ListIcon size={18} />}>
            <XIcon size={18} />
          </Show>
        </Box>

        <Suspense fallback={null}>
          <VisualCanvas
            docs={visibleDocs()}
            positions={positions}
            umapRegions={umapRegions}
            viewportWidth={() =>
              Math.max(1, viewportW() - rightInset(viewportW()))
            }
            viewportHeight={() =>
              Math.max(1, viewportH() - canvasStore.navHeight())
            }
            hoveredId={hover.hoveredId}
            railHoveredId={railHoveredDocId}
            viewTransform={viewTransform}
            offset={canvasStore.offset}
            navHeight={canvasStore.navHeight}
            scale={canvasStore.scale}
            isPanning={canvasStore.isPanning}
            searchQuery={searchQuery}
            matchingDocIds={matchingDocIds}
            notesInteractive={notesInteractive}
            activeDocId={selectedId}
            eventHandlers={canvasEventHandlers}
            hoveredRegionId={hoveredRegionId}
            onHoveredRegionChange={setHoveredRegionId}
            onPressedRegionChange={setPressedRegionId}
            suppressNextOpen={panZoomHandlers.blockNextOpen}
            onSelectDoc={requestSelectedId}
            onHoveredDocChange={setRailHoveredDocId}
            onZoomToRegion={handleZoomToRegion}
            selectedRegionId={selectedRegionId}
            regionsOnly={regionsOnly}
            selection={selectionStore}
          />
        </Suspense>

        <Show when={docs.error}>
          <Box
            position="absolute"
            inset="0"
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap="3"
          >
            <Text fontSize="sm" color="fg.muted">
              Couldn’t load notes.
            </Text>
            <Button size="xs" variant="outline" onClick={() => refetchDocs()}>
              Retry
            </Button>
          </Box>
        </Show>
        <Show when={docs.loading && !loadedDocs()}>
          <Box
            position="absolute"
            inset="0"
            display="flex"
            alignItems="center"
            justifyContent="center"
            pointerEvents="none"
          >
            <Text fontSize="sm" color="fg.muted">
              Loading notes…
            </Text>
          </Box>
        </Show>
        <Show when={loadedDocs()?.length === 0}>
          <Box
            position="absolute"
            inset="0"
            display="flex"
            alignItems="center"
            justifyContent="center"
            pointerEvents="none"
          >
            <Text fontSize="sm" color="fg.muted">
              No notes yet — new notes appear here as dots.
            </Text>
          </Box>
        </Show>

        <Box
          position="absolute"
          zIndex="11"
          right="3"
          bottom="3"
          display={{ base: mobileRailOpen() ? "block" : "none", md: "block" }}
          // Keep in sync with CANVAS_SIDE_RAIL_WIDTH_PX (Panda needs a literal).
          w={{ base: "auto", md: "272px" }}
          left={{ base: "3", md: "auto" }}
          mt={{ base: "12", md: "0" }}
          bg="bg.default"
          borderRadius="l2"
          boxShadow="md"
          overflow="hidden"
          style={{ top: overlayTop() }}
          onWheel={(e) => e.stopPropagation()}
        >
          <CanvasSideRail
            mode={railMode}
            regions={regionList}
            islands={() => umapRegions()?.islands ?? []}
            allDocs={() => loadedDocs() ?? []}
            noteOpen={() => !!selectedId()}
            selectedRegion={selectedRegion}
            docs={railDocs}
            searchQuery={searchQuery}
            hoveredRegionId={hoveredRegionId}
            hoveredDocId={() => railHoveredDocId() ?? hover.hoveredId()}
            selectedDocId={selectedId}
            onHoveredRegionChange={setHoveredRegionId}
            onHoveredDocChange={setRailHoveredDocId}
            onZoomToRegion={handleZoomToRegion}
            onClearRegion={clearSelectedRegion}
            onOpenDoc={(id) => {
              setMobileRailOpen(false);
              requestSelectedId(id);
            }}
          />
        </Box>

        <DocumentSidePanel
          open={!!selectedId()}
          docId={selectedId()}
          modal={false}
          width={PANEL_WIDTH}
          onEditorApiChange={handleEditorApiChange}
          onClose={() => requestSelectedId(undefined)}
          onDeleted={(deletedDocId) => {
            refetchDocs();
            if (selectedId() === deletedDocId) {
              // The note is already deleted, so preserve the delete flow without
              // prompting to discard edits from the now-removed editor.
              setPendingSelectedId(undefined);
              setDiscardDialogOpen(false);
              setSaveInProgressDialogOpen(false);
              setSelectedId(undefined);
            }
          }}
        />
        <ConfirmDialog
          open={discardDialogOpen()}
          onOpenChange={(open) => {
            setDiscardDialogOpen(open);
            if (!open) setPendingSelectedId(undefined);
          }}
          title="Discard unsaved changes?"
          description="Your unsaved changes will be lost if you leave this note."
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          onConfirm={() => {
            setSelectedId(pendingSelectedId());
            setPendingSelectedId(undefined);
          }}
        />
        <SimpleDialog
          open={saveInProgressDialogOpen()}
          onOpenChange={setSaveInProgressDialogOpen}
          title="Note is saving"
          description="Wait for this save to finish before closing or opening another note."
          footer={
            <Button
              variant="solid"
              onClick={() => setSaveInProgressDialogOpen(false)}
            >
              Keep editing
            </Button>
          }
        />
      </Show>
    </Box>
  );
};

export default CanvasRoute;
