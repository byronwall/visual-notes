import { createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { DEFAULT_RAIL_HEIGHT, PINNED_MIN_TOP, RIGHT_GAP } from "./constants";
import { extractTocItems, findHeadingByLevelAndText } from "./headings";
import { computeTocLayout } from "./layout";
import { computeMarkers, computeVisibleMarkerBounds } from "./markers";
import { getHeadingViewportTops, resolveActiveRange } from "./range";
import { type TocItem, type TocLayout } from "./types";

type UseTocControllerOptions = {
  getRootEl: () => HTMLElement | null;
};

const DEFAULT_LAYOUT: TocLayout = {
  mode: "rail",
  leftPx: RIGHT_GAP,
  widthPx: 0,
  railHeightPx: DEFAULT_RAIL_HEIGHT,
};

export type TocController = ReturnType<typeof useTocController>;

export function useTocController(options: UseTocControllerOptions) {
  const [items, setItems] = createSignal<TocItem[]>([]);
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [visibleStartIndex, setVisibleStartIndex] = createSignal(0);
  const [visibleEndIndex, setVisibleEndIndex] = createSignal(0);
  const [layout, setLayout] = createSignal<TocLayout>(DEFAULT_LAYOUT);
  const [pinnedTopPx, setPinnedTopPx] = createSignal(PINNED_MIN_TOP);
  const [viewportHeightPx, setViewportHeightPx] = createSignal(800);
  const [positionTick, setPositionTick] = createSignal(0);

  // A single heading is not worth an outline.
  const hasItems = createMemo(() => items().length >= 2);

  const minHeadingLevel = createMemo(() => {
    const levels = items().map((item) => item.level);
    if (levels.length === 0) return 1;
    return Math.min(...levels) as TocItem["level"];
  });

  const railTopPx = createMemo(() =>
    Math.max(
      PINNED_MIN_TOP,
      Math.round((viewportHeightPx() - layout().railHeightPx) / 2),
    ),
  );

  let lastSignature = "";
  let observedRoot: HTMLElement | null = null;
  let observer: MutationObserver | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let recollectTimer: number | undefined;
  let rootPollTimer: number | undefined;
  let positionFrame: number | undefined;
  let geometryDirty = false;
  let headingOffsets: number[] = [];

  function resolveHeadingEl(item: TocItem): HTMLElement | null {
    if (item.el && item.el.isConnected) return item.el;
    const byId = document.getElementById(item.id);
    if (byId) return byId;
    return (
      findHeadingByLevelAndText(
        options.getRootEl(),
        item.level,
        item.text,
        item.occurrence,
      ) ??
      item.el ??
      null
    );
  }

  function refreshLayout() {
    setViewportHeightPx(window.innerHeight);
    const root = options.getRootEl();
    setLayout(root ? computeTocLayout(root, items().length) : DEFAULT_LAYOUT);
  }

  function updateActiveIndex(
    root = options.getRootEl(),
    rootRect = root?.getBoundingClientRect(),
  ) {
    const list = items();
    if (rootRect) {
      // Start level with the note body, then stick below the toolbar.
      setPinnedTopPx(Math.max(PINNED_MIN_TOP, Math.round(rootRect.top)));
    }
    if (list.length === 0) {
      setActiveIndex(0);
      setVisibleStartIndex(0);
      setVisibleEndIndex(0);
      return;
    }

    const rootContentTop = rootRect
      ? rootRect.top + (root?.clientTop ?? 0)
      : Number.NEGATIVE_INFINITY;
    const rootContentBottom = rootRect
      ? rootContentTop + (root?.clientHeight ?? 0)
      : Number.POSITIVE_INFINITY;
    const headingViewportTops = rootRect
      ? getHeadingViewportTops(
          rootContentTop,
          headingOffsets,
          root?.scrollTop ?? 0,
        )
      : list.map(() => Number.POSITIVE_INFINITY);
    const visibleTop = Math.max(80, rootContentTop);
    const visibleBottom = Math.min(window.innerHeight - 24, rootContentBottom);

    const range = resolveActiveRange(
      headingViewportTops,
      visibleTop,
      visibleBottom,
    );
    // The last sections can be too short to reach the reading line. Once
    // the page can't scroll further, the lowest heading on screen is current.
    const atBottom =
      window.scrollY > 0 &&
      window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
    setActiveIndex(atBottom ? range.endIdx : range.startIdx);
    setVisibleStartIndex(range.startIdx);
    setVisibleEndIndex(range.endIdx);
  }

  function refreshTocGeometry(
    currentItems = items(),
    root = options.getRootEl(),
  ) {
    const rootRect = root?.getBoundingClientRect();
    const rootContentTop = rootRect ? rootRect.top + (root?.clientTop ?? 0) : 0;
    headingOffsets = currentItems.map((item) => {
      const el = resolveHeadingEl(item);
      return el
        ? el.getBoundingClientRect().top -
            rootContentTop +
            (root?.scrollTop ?? 0)
        : 0;
    });
    setPositionTick((prev) => prev + 1);
    updateActiveIndex(root, rootRect);
  }

  function schedulePositionUpdate(refreshGeometry = false) {
    geometryDirty ||= refreshGeometry;
    if (positionFrame !== undefined) return;

    positionFrame = window.requestAnimationFrame(() => {
      positionFrame = undefined;
      const root = options.getRootEl();
      if (root !== observedRoot) {
        geometryDirty = false;
        bindRoot(root);
        return;
      }
      if (geometryDirty) {
        geometryDirty = false;
        refreshTocGeometry();
      } else {
        updateActiveIndex();
      }
    });
  }

  function collectHeadings(root: HTMLElement | null) {
    if (!root) {
      setItems([]);
      return;
    }

    const found = extractTocItems(root);
    const signature = found
      .map((item) => `${item.level}:${item.id}:${item.blockId}:${item.text}`)
      .join("|");

    if (signature !== lastSignature) {
      lastSignature = signature;
      setItems(found);
    }
  }

  function bindRoot(nextRoot: HTMLElement | null) {
    if (nextRoot === observedRoot) return;

    observedRoot = nextRoot;
    lastSignature = "";
    observer?.disconnect();
    resizeObserver?.disconnect();

    if (!nextRoot) {
      setItems([]);
      headingOffsets = [];
      setActiveIndex(0);
      setVisibleStartIndex(0);
      setVisibleEndIndex(0);
      refreshLayout();
      return;
    }

    collectHeadings(nextRoot);
    refreshLayout();
    refreshTocGeometry();

    observer = new MutationObserver(() => scheduleRecollect());
    observer.observe(nextRoot, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    resizeObserver?.observe(nextRoot);
  }

  function scheduleRecollect() {
    if (recollectTimer) window.clearTimeout(recollectTimer);
    recollectTimer = window.setTimeout(() => {
      const root = options.getRootEl();
      if (root) {
        bindRoot(root);
        collectHeadings(root);
      } else if (!observedRoot) {
        bindRoot(null);
      } else {
        collectHeadings(observedRoot);
      }
      refreshLayout();
      schedulePositionUpdate(true);
    }, 250);
  }

  function onItemClick(item: TocItem) {
    const target = resolveHeadingEl(item);
    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: "smooth" });
    // Keep the section in the URL so a refresh or a shared link lands here.
    // replaceState skips the router, so the block flash only runs on load.
    if (item.blockId) {
      history.replaceState(history.state, "", `#b-${item.blockId}`);
    }
  }

  const markers = createMemo(() => {
    positionTick();
    return computeMarkers({
      items: items(),
      root: options.getRootEl(),
      railHeightPx: layout().railHeightPx,
      resolveHeadingEl,
    });
  });

  const visibleMarkerBounds = createMemo(() =>
    computeVisibleMarkerBounds(
      markers(),
      visibleStartIndex(),
      visibleEndIndex(),
    ),
  );

  onMount(() => {
    resizeObserver = new ResizeObserver(() => {
      refreshLayout();
      schedulePositionUpdate(true);
    });
    bindRoot(options.getRootEl());
    refreshLayout();
    refreshTocGeometry();

    rootPollTimer = window.setInterval(() => {
      const root = options.getRootEl();
      if (!root) return;
      bindRoot(root);
      window.clearInterval(rootPollTimer);
      rootPollTimer = undefined;
    }, 300);

    const onScroll = () => schedulePositionUpdate();
    const onResize = () => {
      refreshLayout();
      schedulePositionUpdate(true);
    };
    const onRebind = () => {
      if (document.hidden) return;
      window.requestAnimationFrame(() => {
        bindRoot(options.getRootEl());
        schedulePositionUpdate(true);
      });
    };
    const onLoad = (event: Event) => {
      if (event.target instanceof HTMLImageElement) {
        schedulePositionUpdate(true);
      }
    };
    const onFonts = () => schedulePositionUpdate(true);

    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", onResize);
    window.addEventListener("focus", onRebind);
    window.addEventListener("load", onLoad, true);
    document.addEventListener("visibilitychange", onRebind);
    document.fonts.addEventListener("loadingdone", onFonts);

    onCleanup(() => {
      if (recollectTimer) window.clearTimeout(recollectTimer);
      if (rootPollTimer) window.clearInterval(rootPollTimer);
      if (positionFrame !== undefined)
        window.cancelAnimationFrame(positionFrame);
      observer?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("focus", onRebind);
      window.removeEventListener("load", onLoad, true);
      document.removeEventListener("visibilitychange", onRebind);
      document.fonts.removeEventListener("loadingdone", onFonts);
    });
  });

  return {
    activeIndex,
    hasItems,
    items,
    layout,
    markers,
    minHeadingLevel,
    onItemClick,
    pinnedTopPx,
    railTopPx,
    visibleEndIndex,
    visibleMarkerBounds,
    visibleStartIndex,
  };
}
