import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type Accessor,
} from "solid-js";
import {
  COMPACT_RAIL_HEIGHT,
  DEFAULT_PANEL_LEFT,
  DEFAULT_PANEL_OFFSET,
  DEFAULT_PANEL_WIDTH,
  DEFAULT_RAIL_HEIGHT,
  EXPANDED_TOP_GUTTER,
  MIN_RAIL_HEIGHT,
  RAIL_REST_TOP,
} from "./constants";
import { extractTocItems, findHeadingByLevelAndText } from "./headings";
import {
  computeTocLayout,
  getEffectiveContentHeight,
  getPanelMaxHeightCss,
  getViewportMaxHeightPx,
} from "./layout";
import { computeMarkers, computeVisibleMarkerBounds } from "./markers";
import { resolveActiveRange } from "./range";
import { type TocItem } from "./types";
import { clamp } from "./utils";

type UseTocControllerOptions = {
  getRootEl: () => HTMLElement | null;
  maxVh: Accessor<number>;
};

export function useTocController(options: UseTocControllerOptions) {
  const [items, setItems] = createSignal<TocItem[]>([]);
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [visibleStartIndex, setVisibleStartIndex] = createSignal(0);
  const [visibleEndIndex, setVisibleEndIndex] = createSignal(0);

  const [showExpandedByDefault, setShowExpandedByDefault] = createSignal(false);
  const [isHoverExpanded, setIsHoverExpanded] = createSignal(false);

  const [panelLeftPx, setPanelLeftPx] = createSignal(DEFAULT_PANEL_LEFT);
  const [panelWidthPx, setPanelWidthPx] = createSignal(DEFAULT_PANEL_WIDTH);
  const [panelOffsetPx, setPanelOffsetPx] = createSignal(DEFAULT_PANEL_OFFSET);
  const [railHeightPx, setRailHeightPx] = createSignal(DEFAULT_RAIL_HEIGHT);
  const [compactAtRest, setCompactAtRest] = createSignal(false);
  const [expandedPanelHeightPx, setExpandedPanelHeightPx] = createSignal(320);
  const [viewportHeightPx, setViewportHeightPx] = createSignal(800);
  const [positionTick, setPositionTick] = createSignal(0);

  const showExpandedPanel = createMemo(
    () => showExpandedByDefault() || isHoverExpanded()
  );
  const hasItems = createMemo(() => items().length > 0);

  const minHeadingLevel = createMemo(() => {
    const levels = items().map((item) => item.level);
    if (levels.length === 0) return 1;
    return Math.min(...levels) as TocItem["level"];
  });

  const panelMaxHeightCss = createMemo(() => getPanelMaxHeightCss(options.maxVh()));

  const collapsedRailHeightPx = createMemo(() => {
    if (!compactAtRest()) return railHeightPx();
    return Math.min(railHeightPx(), COMPACT_RAIL_HEIGHT);
  });

  const expandedTopMode = createMemo(() => {
    const panelHeight = expandedPanelHeightPx();
    const viewportHeight = viewportHeightPx();
    const anchoredBottom = RAIL_REST_TOP + COMPACT_RAIL_HEIGHT;
    const growCapacity = anchoredBottom - EXPANDED_TOP_GUTTER;
    const centeredTop = clamp(
      (viewportHeight - panelHeight) / 2,
      EXPANDED_TOP_GUTTER,
      Math.max(
        EXPANDED_TOP_GUTTER,
        viewportHeight - panelHeight - EXPANDED_TOP_GUTTER
      )
    );
    const growTop = clamp(
      anchoredBottom - panelHeight,
      EXPANDED_TOP_GUTTER,
      RAIL_REST_TOP
    );
    const mode = panelHeight > growCapacity ? "grow-up" : "center";

    return {
      mode,
      top: mode === "grow-up" ? growTop : centeredTop,
      panelHeight,
      viewportHeight,
      growCapacity,
      centeredTop,
      growTop,
      anchoredBottom,
    } as const;
  });

  const containerTopPx = createMemo(() => {
    if (!showExpandedPanel()) {
      const collapsedHeight = collapsedRailHeightPx();
      return Math.max(
        EXPANDED_TOP_GUTTER,
        Math.round((viewportHeightPx() - collapsedHeight) / 2)
      );
    }
    return expandedTopMode().top;
  });

  let listRef: HTMLElement | undefined;
  let listScrollRef: HTMLElement | undefined;
  let expandedPanelRef: HTMLElement | undefined;

  let lastSignature = "";
  let observedRoot: HTMLElement | null = null;
  let observer: MutationObserver | undefined;
  let recollectTimer: number | undefined;
  let rootPollTimer: number | undefined;
  let scrollHandler: (() => void) | undefined;
  let resizeHandler: (() => void) | undefined;
  let focusHandler: (() => void) | undefined;
  let visibilityHandler: (() => void) | undefined;
  let wasExpanded = false;

  function resolveHeadingEl(item: TocItem): HTMLElement | null {
    if (item.el && item.el.isConnected) return item.el;

    const byId = document.getElementById(item.id);
    if (byId) return byId;

    const root = options.getRootEl();
    const byText = findHeadingByLevelAndText(
      root,
      item.level,
      item.text,
      item.occurrence
    );
    if (byText) return byText;

    return item.el || null;
  }

  function resetLayoutState() {
    setPanelLeftPx(DEFAULT_PANEL_LEFT);
    setPanelWidthPx(DEFAULT_PANEL_WIDTH);
    setPanelOffsetPx(DEFAULT_PANEL_OFFSET);
    setRailHeightPx(DEFAULT_RAIL_HEIGHT);
    setViewportHeightPx(window.innerHeight);
    setCompactAtRest(false);
    setShowExpandedByDefault(false);
    setIsHoverExpanded(false);
  }

  function refreshLayoutMode() {
    const root = options.getRootEl();
    setViewportHeightPx(window.innerHeight);

    if (!root) {
      if (!hasItems()) {
        resetLayoutState();
      }
      return;
    }

    const layout = computeTocLayout(root, options.maxVh(), items().length);

    setPanelLeftPx(layout.panelLeftPx);
    setPanelWidthPx(layout.panelWidthPx);
    setPanelOffsetPx(layout.panelOffsetPx);
    setCompactAtRest(layout.compactAtRest);
    setShowExpandedByDefault(layout.showExpandedByDefault);

    if (!showExpandedPanel()) {
      setRailHeightPx(layout.railHeightPx);
    }

    if (layout.showExpandedByDefault) {
      setIsHoverExpanded(false);
    }
  }

  function updateActiveIndex(currentItems?: TocItem[]) {
    const list = currentItems ?? items();
    if (list.length === 0) {
      setActiveIndex(0);
      setVisibleStartIndex(0);
      setVisibleEndIndex(0);
      return;
    }

    const root = options.getRootEl();
    const rootRect = root?.getBoundingClientRect();
    const rootTopAbs = rootRect
      ? rootRect.top + window.scrollY
      : Number.NEGATIVE_INFINITY;
    const rootBottomAbs = rootRect
      ? rootRect.bottom + window.scrollY
      : Number.POSITIVE_INFINITY;
    const viewportTopAbs = window.scrollY + 80;
    const viewportBottomAbs = window.scrollY + window.innerHeight - 24;
    const visibleTopAbs = Math.max(viewportTopAbs, rootTopAbs);
    const visibleBottomAbs = Math.min(viewportBottomAbs, rootBottomAbs);

    const headingAbsTops = list.map((item) => {
      const el = resolveHeadingEl(item);
      return el
        ? el.getBoundingClientRect().top + window.scrollY
        : Number.POSITIVE_INFINITY;
    });

    const range = resolveActiveRange(headingAbsTops, visibleTopAbs, visibleBottomAbs);
    setActiveIndex(range.startIdx);
    setVisibleStartIndex(range.startIdx);
    setVisibleEndIndex(range.endIdx);

  }

  function recomputeTocPositions() {
    setPositionTick((prev) => prev + 1);
    updateActiveIndex();
  }

  function collectHeadings(root: HTMLElement | null) {
    if (!root) {
      setItems([]);
      return;
    }

    const found = extractTocItems(root);
    const signature = found.map((item) => `${item.level}:${item.id}:${item.text}`).join("|");

    if (signature !== lastSignature) {
      lastSignature = signature;
      setItems(found);
      updateActiveIndex(found);
    }
  }

  function bindRoot(nextRoot: HTMLElement | null) {
    if (nextRoot === observedRoot) return;

    observedRoot = nextRoot;
    lastSignature = "";
    if (observer) observer.disconnect();

    if (!nextRoot) {
      setItems([]);
      setActiveIndex(0);
      setVisibleStartIndex(0);
      setVisibleEndIndex(0);
      resetLayoutState();
      return;
    }

    collectHeadings(nextRoot);
    refreshLayoutMode();

    observer = new MutationObserver(() => {
      scheduleRecollect();
    });

    observer.observe(nextRoot, {
      childList: true,
      subtree: true,
      characterData: true,
    });
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
      refreshLayoutMode();
      recomputeTocPositions();
    }, 250);
  }

  function onItemClick(item: TocItem) {
    const target = resolveHeadingEl(item);
    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: "smooth" });
  }

  function onRailMouseEnter() {
    if (!showExpandedByDefault()) {
      setIsHoverExpanded(true);
    }
  }

  function onRailMouseLeave() {
    if (!showExpandedByDefault()) {
      setIsHoverExpanded(false);
    }
  }

  function scrollListToActive(mode: "center" | "keep-visible") {
    const idx = activeIndex();
    const itemEl = listRef?.querySelector(`[data-toc-idx="${idx}"]`) as HTMLElement | null;
    const scrollEl = listScrollRef;
    if (!itemEl || !scrollEl) return;

    const containerRect = scrollEl.getBoundingClientRect();
    const itemRect = itemEl.getBoundingClientRect();
    const itemTop = itemRect.top - containerRect.top + scrollEl.scrollTop;
    const itemBottom = itemTop + itemRect.height;
    const viewTop = scrollEl.scrollTop;
    const viewBottom = viewTop + scrollEl.clientHeight;
    const padding = 24;

    if (mode === "center") {
      const centeredTop = itemTop - (scrollEl.clientHeight - itemRect.height) / 2;
      scrollEl.scrollTo({ top: Math.max(centeredTop, 0), behavior: "auto" });
      return;
    }

    if (itemTop < viewTop + padding) {
      scrollEl.scrollTo({ top: Math.max(itemTop - padding, 0), behavior: "auto" });
      return;
    }

    if (itemBottom > viewBottom - padding) {
      const nextTop = itemBottom - scrollEl.clientHeight + padding;
      scrollEl.scrollTo({ top: Math.max(nextTop, 0), behavior: "auto" });
    }
  }

  const markers = createMemo(() => {
    positionTick();
    return computeMarkers({
      items: items(),
      root: options.getRootEl(),
      railHeightPx: railHeightPx(),
      resolveHeadingEl,
    });
  });

  const visibleMarkerBounds = createMemo(() => {
    return computeVisibleMarkerBounds(markers(), visibleStartIndex(), visibleEndIndex());
  });

  onMount(() => {
    bindRoot(options.getRootEl());
    refreshLayoutMode();
    recomputeTocPositions();

    rootPollTimer = window.setInterval(() => {
      const root = options.getRootEl();
      if (!root) return;
      bindRoot(root);
      if (rootPollTimer) {
        window.clearInterval(rootPollTimer);
        rootPollTimer = undefined;
      }
    }, 300);

    scrollHandler = () => recomputeTocPositions();
    resizeHandler = () => {
      scheduleRecollect();
      refreshLayoutMode();
      recomputeTocPositions();
    };
    focusHandler = () => {
      window.requestAnimationFrame(() => {
        bindRoot(options.getRootEl());
        scheduleRecollect();
      });
    };
    visibilityHandler = () => {
      if (document.hidden) return;
      window.requestAnimationFrame(() => {
        bindRoot(options.getRootEl());
        scheduleRecollect();
      });
    };

    window.addEventListener("scroll", scrollHandler, { passive: true });
    window.addEventListener("resize", resizeHandler);
    window.addEventListener("focus", focusHandler);
    document.addEventListener("visibilitychange", visibilityHandler);

    onCleanup(() => {
      if (recollectTimer) window.clearTimeout(recollectTimer);
      if (rootPollTimer) window.clearInterval(rootPollTimer);
      if (observer) observer.disconnect();
      if (scrollHandler) window.removeEventListener("scroll", scrollHandler);
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      if (focusHandler) window.removeEventListener("focus", focusHandler);
      if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler);
      }
    });
  });

  createEffect(() => {
    const isExpanded = showExpandedPanel();
    if (isExpanded && !wasExpanded) {
      window.requestAnimationFrame(() => scrollListToActive("center"));
    }
    wasExpanded = isExpanded;
  });

  createEffect(() => {
    if (!showExpandedPanel()) return;
    activeIndex();
    window.requestAnimationFrame(() => scrollListToActive("keep-visible"));
  });

  createEffect(() => {
    panelWidthPx();
    items().length;
    showExpandedPanel();

    window.requestAnimationFrame(() => {
      const panel = expandedPanelRef;
      if (!panel) return;

      const viewportMaxHeightPx = getViewportMaxHeightPx(options.maxVh());
      const measuredHeight = panel.getBoundingClientRect().height;

      setExpandedPanelHeightPx(Math.max(Math.floor(measuredHeight), MIN_RAIL_HEIGHT));
      if (!showExpandedPanel()) return;

      setRailHeightPx(clamp(Math.floor(measuredHeight), MIN_RAIL_HEIGHT, viewportMaxHeightPx));
    });
  });

  return {
    activeIndex,
    collapsedRailHeightPx,
    containerTopPx,
    isHoverExpanded,
    items,
    minHeadingLevel,
    onItemClick,
    onListReady: () => {
      if (showExpandedPanel()) {
        window.requestAnimationFrame(() => scrollListToActive("center"));
      }
    },
    onListRef: (el: HTMLElement | undefined) => {
      listRef = el;
    },
    onListScrollRef: (el: HTMLElement | undefined) => {
      listScrollRef = el;
    },
    onPanelRef: (el: HTMLElement | undefined) => {
      expandedPanelRef = el;
    },
    onRailMouseEnter,
    onRailMouseLeave,
    panelLeftPx,
    panelMaxHeightCss,
    panelOffsetPx,
    panelWidthPx,
    setIsHoverExpanded,
    showExpandedByDefault,
    showExpandedPanel,
    visibleEndIndex,
    visibleMarkerBounds,
    visibleStartIndex,
    markers,
    hasItems,
  };
}
