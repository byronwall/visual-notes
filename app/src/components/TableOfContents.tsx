import {
  type VoidComponent,
  For,
  Show,
  createComputed,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { Button } from "~/components/ui/button";
import { Box, Stack } from "styled-system/jsx";

type TocItem = {
  id: string;
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  occurrence: number;
  el: HTMLElement;
};

type TocMarker = {
  item: TocItem;
  index: number;
  topRatio: number;
  displayTopRatio: number;
  spanRatio: number;
};

type TocLayout = {
  panelLeftPx: number;
  panelWidthPx: number;
  panelOffsetPx: number;
  railHeightPx: number;
  compactAtRest: boolean;
  showExpandedByDefault: boolean;
};

const DEFAULT_MAX_VH = 100;
const DEFAULT_PANEL_WIDTH = 288;
const DEFAULT_PANEL_LEFT = 12;
const DEFAULT_PANEL_OFFSET = 40;
const DEFAULT_RAIL_HEIGHT = 220;
const VIEWPORT_PADDING = 8;
const RIGHT_GAP = 12;
const RAIL_WIDTH = 32;
const PANEL_GAP = 8;
const MAX_PANEL_WIDTH = 320;
const IDEAL_PANEL_WIDTH = 288;
const MIN_RAIL_HEIGHT = 88;
const COMPACT_RAIL_HEIGHT = 100;
const RAIL_REST_TOP = 300;
const EXPANDED_TOP_GUTTER = 12;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getViewportMaxHeightPx(maxVh: number) {
  return Math.max(
    MIN_RAIL_HEIGHT,
    Math.floor(Math.min(window.innerHeight - 24, window.innerHeight * (maxVh / 100)))
  );
}

function getPanelMaxHeightCss(maxVh: number) {
  return `min(calc(100vh - 0.75rem), ${maxVh}vh)`;
}

function extractTocItems(root: HTMLElement): TocItem[] {
  const occurrenceByKey = new Map<string, number>();
  const mapped = Array.from(
    root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")
  ).map((el, index) => {
    const tag = el.tagName.toLowerCase();
    const parsedLevel = Number(tag.slice(1));
    const level = (parsedLevel >= 1 && parsedLevel <= 6 ? parsedLevel : 1) as TocItem["level"];
    const text = (el.textContent || "").trim();
    const key = `${level}:${text}`;
    const occurrence = occurrenceByKey.get(key) ?? 0;
    occurrenceByKey.set(key, occurrence + 1);
    const id = el.id || slugify(text) || `section-${level}-${index + 1}-${occurrence}`;
    return { id, text, level, occurrence, el } as TocItem;
  });

  const h1Count = mapped.filter((item) => item.level === 1).length;
  const first = mapped[0];
  if (h1Count === 1 && first?.level === 1) {
    return mapped.filter((_, idx) => idx !== 0);
  }

  return mapped;
}

function findHeadingByLevelAndText(
  root: HTMLElement | null,
  level: 1 | 2 | 3 | 4 | 5 | 6,
  text: string,
  occurrence: number
): HTMLElement | null {
  if (!root) return null;
  const nodes = root.querySelectorAll<HTMLElement>(`h${level}`);
  const targetText = (text || "").trim();
  let seen = 0;
  for (const el of Array.from(nodes)) {
    if ((el.textContent || "").trim() !== targetText) continue;
    if (seen === occurrence) return el;
    seen += 1;
  }
  return null;
}

function computeTocLayout(root: HTMLElement, maxVh: number, itemCount: number): TocLayout {
  const rect = root.getBoundingClientRect();

  const railLeft = clamp(
    rect.right + RIGHT_GAP,
    VIEWPORT_PADDING + RAIL_WIDTH,
    window.innerWidth - VIEWPORT_PADDING - RAIL_WIDTH
  );

  const maxUsablePanelWidth = Math.max(120, window.innerWidth - VIEWPORT_PADDING * 2);
  const panelWidthPx = Math.min(MAX_PANEL_WIDTH, maxUsablePanelWidth);

  const desiredPanelLeft = railLeft + RAIL_WIDTH + PANEL_GAP;
  const clampedPanelLeft = clamp(
    desiredPanelLeft,
    VIEWPORT_PADDING,
    window.innerWidth - VIEWPORT_PADDING - panelWidthPx
  );
  const idealRailLeft = rect.right + RIGHT_GAP;
  const compactAtRest = railLeft < idealRailLeft - 1;

  const rightPanelRoom = window.innerWidth - VIEWPORT_PADDING - desiredPanelLeft;
  const showExpandedByDefault = rightPanelRoom >= panelWidthPx && rightPanelRoom >= IDEAL_PANEL_WIDTH;

  const viewportMaxHeightPx = getViewportMaxHeightPx(maxVh);
  const railHeightPx = clamp(20 + itemCount * 32, MIN_RAIL_HEIGHT, viewportMaxHeightPx);

  return {
    panelLeftPx: railLeft,
    panelWidthPx,
    panelOffsetPx: clampedPanelLeft - railLeft,
    railHeightPx,
    compactAtRest,
    showExpandedByDefault,
  };
}

function getEffectiveContentHeight(root: HTMLElement): number {
  const rootTop = root.getBoundingClientRect().top + window.scrollY;
  const blocks = Array.from(
    root.querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,table,hr,img,video,code"
    )
  );
  let maxBottom = 0;

  for (const block of blocks) {
    if (block.offsetHeight <= 0) continue;

    const text = (block.textContent || "").trim();
    const hasRenderableContent =
      text.length > 0 ||
      block.querySelector("img,video,table,pre,code,hr,blockquote,iframe,svg") !== null;
    if (!hasRenderableContent) continue;

    const blockBottom = block.getBoundingClientRect().bottom + window.scrollY - rootTop;
    if (blockBottom > maxBottom) {
      maxBottom = blockBottom;
    }
  }

  if (maxBottom <= 0) {
    return Math.max(root.scrollHeight, 1);
  }

  return Math.max(maxBottom, 1);
}

function distributeMarkerRatios(raw: number[], min: number, max: number, minGap: number) {
  if (raw.length === 0) return [];
  const clamped = raw.map((value) => clamp(value, min, max));
  const forward: number[] = [];

  for (const value of clamped) {
    if (forward.length === 0) {
      forward.push(value);
      continue;
    }
    forward.push(Math.max(value, forward[forward.length - 1] + minGap));
  }

  for (let i = forward.length - 1; i >= 0; i--) {
    const maxForIndex = max - (forward.length - 1 - i) * minGap;
    forward[i] = Math.min(forward[i], maxForIndex);
    if (i > 0 && forward[i] - forward[i - 1] < minGap) {
      forward[i - 1] = forward[i] - minGap;
    }
  }

  return forward.map((value) => clamp(value, min, max));
}

function resolveActiveRange(
  headingAbsTops: number[],
  visibleTopAbs: number,
  visibleBottomAbs: number
) {
  if (headingAbsTops.length === 0) {
    return { startIdx: 0, endIdx: 0 };
  }

  const firstAfterTop = headingAbsTops.findIndex((top) => top > visibleTopAbs);

  let startIdx = 0;
  if (firstAfterTop === -1) {
    startIdx = headingAbsTops.length - 1;
  } else if (firstAfterTop === 0) {
    startIdx = 0;
  } else {
    startIdx = firstAfterTop - 1;
  }

  const firstAfterBottom = headingAbsTops.findIndex((top) => top > visibleBottomAbs);

  let endIdx = 0;
  if (firstAfterBottom === -1) {
    endIdx = headingAbsTops.length - 1;
  } else if (firstAfterBottom === 0) {
    endIdx = 0;
  } else {
    endIdx = firstAfterBottom - 1;
  }

  if (endIdx < startIdx) endIdx = startIdx;
  if (endIdx >= headingAbsTops.length) endIdx = headingAbsTops.length - 1;

  return { startIdx, endIdx };
}

export const TableOfContents: VoidComponent<{
  getRootEl: () => HTMLElement | null;
  class?: string;
  maxVh?: number;
}> = (props) => {
  const maxVh = () => props.maxVh ?? DEFAULT_MAX_VH;

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

  const minHeadingLevel = createMemo(() => {
    const levels = items().map((it) => it.level);
    if (levels.length === 0) return 1;
    return Math.min(...levels) as TocItem["level"];
  });

  const panelMaxHeight = createMemo(() => getPanelMaxHeightCss(maxVh()));
  const collapsedRailHeightPx = createMemo(() => {
    if (!compactAtRest()) return railHeightPx();
    return Math.min(railHeightPx(), COMPACT_RAIL_HEIGHT);
  });
  const expandedTopMode = createMemo(() => {
    const panelHeight = expandedPanelHeightPx();
    const viewportHeight = viewportHeightPx();
    // Use a stable compact anchor baseline so expand behavior is not distorted
    // by large measured rail heights.
    const anchoredBottom = RAIL_REST_TOP + COMPACT_RAIL_HEIGHT;
    const growCapacity = anchoredBottom - EXPANDED_TOP_GUTTER;
    const centeredTop = clamp(
      (viewportHeight - panelHeight) / 2,
      EXPANDED_TOP_GUTTER,
      Math.max(EXPANDED_TOP_GUTTER, viewportHeight - panelHeight - EXPANDED_TOP_GUTTER)
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
  let positionTimer: number | undefined;
  let scrollHandler: (() => void) | undefined;
  let resizeHandler: (() => void) | undefined;
  let wasExpanded = false;
  let lastMarkerDebugSignature = "";
  let lastVisibleRangeDebugSignature = "";
  let lastExpandedTopDebugSignature = "";

  function getDisplayDepth(level: TocItem["level"]) {
    const depth = level - minHeadingLevel();
    return Math.max(depth, 0);
  }

  function resolveHeadingEl(item: TocItem): HTMLElement | null {
    if (item.el && item.el.isConnected) return item.el;

    const byId = document.getElementById(item.id);
    if (byId) return byId;

    const root = props.getRootEl();
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
    const root = props.getRootEl();
    setViewportHeightPx(window.innerHeight);
    if (!root) {
      resetLayoutState();
      return;
    }

    const layout = computeTocLayout(root, maxVh(), items().length);

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

    const root = props.getRootEl();
    const rootRect = root?.getBoundingClientRect();
    const rootTopAbs = rootRect ? rootRect.top + window.scrollY : Number.NEGATIVE_INFINITY;
    const rootBottomAbs = rootRect ? rootRect.bottom + window.scrollY : Number.POSITIVE_INFINITY;
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

    const debugPayload = {
      headingCount: list.length,
      visibleTopAbs: Math.round(visibleTopAbs),
      visibleBottomAbs: Math.round(visibleBottomAbs),
      activeIndex: range.startIdx,
      visibleStartIndex: range.startIdx,
      visibleEndIndex: range.endIdx,
      firstHeadingAbsTop: Math.round(headingAbsTops[0] ?? 0),
      lastHeadingAbsTop: Math.round(headingAbsTops[headingAbsTops.length - 1] ?? 0),
    };
    const signature = JSON.stringify(debugPayload);
    if (signature !== lastVisibleRangeDebugSignature) {
      lastVisibleRangeDebugSignature = signature;
      console.log("[TOC.visible-range] computed", debugPayload);
    }
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
    const signature = found.map((f) => `${f.level}:${f.id}:${f.text}`).join("|");

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
      const root = props.getRootEl();
      bindRoot(root);
      collectHeadings(root);
      refreshLayoutMode();
      recomputeTocPositions();
    }, 250);
  }

  function handleItemClick(item: TocItem) {
    const target = resolveHeadingEl(item);
    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: "smooth" });
  }

  function handleMouseEnter() {
    if (!showExpandedByDefault()) {
      setIsHoverExpanded(true);
    }
  }

  function handleMouseLeave() {
    if (!showExpandedByDefault()) {
      setIsHoverExpanded(false);
    }
  }

  function scrollListToActive(mode: "center" | "keep-visible") {
    const idx = activeIndex();
    const el = listRef?.querySelector(`[data-toc-idx="${idx}"]`) as HTMLElement | null;
    const container = listScrollRef;
    if (!el || !container) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const elTop = elRect.top - containerRect.top + container.scrollTop;
    const elBottom = elTop + elRect.height;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    const padding = 24;

    if (mode === "center") {
      const centeredTop = elTop - (container.clientHeight - elRect.height) / 2;
      container.scrollTo({ top: Math.max(centeredTop, 0), behavior: "auto" });
      return;
    }

    if (elTop < viewTop + padding) {
      container.scrollTo({ top: Math.max(elTop - padding, 0), behavior: "auto" });
      return;
    }

    if (elBottom > viewBottom - padding) {
      const nextTop = elBottom - container.clientHeight + padding;
      container.scrollTo({ top: Math.max(nextTop, 0), behavior: "auto" });
    }
  }

  const markers = createMemo<TocMarker[]>(() => {
    positionTick();
    const list = items();
    if (list.length === 0) return [];
    const railInnerHeightPx = Math.max(railHeightPx() - 6, 1);
    const maxMarkerHeightPx = 7;
    const edgePaddingPx = maxMarkerHeightPx / 2 + 1;
    const edgeRatio = clamp(edgePaddingPx / railInnerHeightPx, 0.02, 0.1);

    const root = props.getRootEl();
    if (!root) {
      const fallbackSpan = 1 / list.length;
      const fallbackRaw = list.map((_, index) =>
        list.length === 1 ? 0.5 : index / (list.length - 1)
      );
      const fallbackDisplay = distributeMarkerRatios(
        fallbackRaw,
        edgeRatio,
        1 - edgeRatio,
        clamp(5 / railInnerHeightPx, 0.004, 0.02)
      );
      return list.map((item, index) => ({
        item,
        index,
        topRatio: list.length === 1 ? 0 : index / (list.length - 1),
        displayTopRatio: fallbackDisplay[index],
        spanRatio: fallbackSpan,
      }));
    }

    const rootTop = root.getBoundingClientRect().top + window.scrollY;
    const docHeight = getEffectiveContentHeight(root);

    const headingTops = list.map((item, index) => {
      const el = resolveHeadingEl(item);
      if (!el) {
        return list.length === 1 ? 0 : (index / (list.length - 1)) * docHeight;
      }
      const absoluteTop = el.getBoundingClientRect().top + window.scrollY;
      return clamp(absoluteTop - rootTop, 0, docHeight);
    });

    const rawSpans = headingTops.map((top, index) => {
      const nextTop = index === headingTops.length - 1 ? docHeight : headingTops[index + 1];
      return Math.max(nextTop - top, docHeight * 0.02);
    });

    const spanTotal = rawSpans.reduce((sum, value) => sum + value, 0) || 1;

    const rawDisplay = list.map((_, index) =>
      clamp(headingTops[index] / docHeight, 0, 1)
    );
    const minGap = clamp(5 / railInnerHeightPx, 0.004, 0.02);
    const distributed = distributeMarkerRatios(
      rawDisplay,
      edgeRatio,
      1 - edgeRatio,
      minGap
    );

    return list.map((item, index) => ({
      item,
      index,
      topRatio: clamp(headingTops[index] / docHeight, 0, 1),
      // Place markers by actual heading position in the document, preserving
      // natural space above the first heading and below the last heading.
      // Clamp only enough to keep markers fully visible within the rail.
      displayTopRatio: distributed[index],
      spanRatio: clamp(rawSpans[index] / spanTotal, 0.02, 0.35),
    }));
  });

  const visibleMarkerBounds = createMemo(() => {
    const markerList = markers();
    if (markerList.length === 0) {
      return { topRatio: 0.02, bottomRatio: 0.98 };
    }

    const startIdx = clamp(visibleStartIndex(), 0, markerList.length - 1);
    const endIdx = clamp(visibleEndIndex(), startIdx, markerList.length - 1);
    const topRatio = markerList[startIdx]?.displayTopRatio ?? 0.02;
    const bottomRatio = markerList[endIdx]?.displayTopRatio ?? 0.98;

    return {
      topRatio: clamp(Math.min(topRatio, bottomRatio), 0.02, 0.98),
      bottomRatio: clamp(Math.max(topRatio, bottomRatio), 0.02, 0.98),
    };
  });

  createComputed(() => {
    const list = items();
    const root = props.getRootEl();
    if (!root || list.length === 0) return;

    const docHeight = getEffectiveContentHeight(root);
    const rootTop = root.getBoundingClientRect().top + window.scrollY;
    const markerList = markers();

    const payload = {
      headingCount: list.length,
      markerCount: markerList.length,
      rootScrollHeight: Math.round(root.scrollHeight),
      effectiveContentHeight: Math.round(docHeight),
      firstHeading: list[0]?.text,
      lastHeading: list[list.length - 1]?.text,
      lastHeadingTopRatio:
        markerList.length > 0
          ? Number(markerList[markerList.length - 1].topRatio.toFixed(3))
          : null,
      lastHeadingDisplayRatio:
        markerList.length > 0
          ? Number(markerList[markerList.length - 1].displayTopRatio.toFixed(3))
          : null,
      topOffsets: list.map((item) => {
        const el = resolveHeadingEl(item);
        if (!el) return null;
        const top = el.getBoundingClientRect().top + window.scrollY - rootTop;
        return Math.round(top);
      }),
    };

    const signature = JSON.stringify(payload);
    if (signature !== lastMarkerDebugSignature) {
      lastMarkerDebugSignature = signature;
      console.log("[TOC.markers] layout", payload);
    }
  });

  createComputed(() => {
    const isExpanded = showExpandedPanel();
    const topInfo = expandedTopMode();
    const payload = {
      isExpanded,
      containerTop: Math.round(containerTopPx()),
      mode: topInfo.mode,
      panelHeight: Math.round(topInfo.panelHeight),
      viewportHeight: Math.round(topInfo.viewportHeight),
      anchoredBottom: Math.round(topInfo.anchoredBottom),
      growCapacity: Math.round(topInfo.growCapacity),
      centeredTop: Math.round(topInfo.centeredTop),
      growTop: Math.round(topInfo.growTop),
    };
    const signature = JSON.stringify(payload);
    if (signature !== lastExpandedTopDebugSignature) {
      lastExpandedTopDebugSignature = signature;
      console.log("[TOC.expand-pos] computed", payload);
    }
  });

  onMount(() => {
    bindRoot(props.getRootEl());
    refreshLayoutMode();
    recomputeTocPositions();

    rootPollTimer = window.setInterval(() => {
      bindRoot(props.getRootEl());
    }, 300);
    positionTimer = window.setInterval(() => {
      recomputeTocPositions();
    }, 700);

    scrollHandler = () => recomputeTocPositions();
    resizeHandler = () => {
      scheduleRecollect();
      refreshLayoutMode();
      recomputeTocPositions();
    };

    window.addEventListener("scroll", scrollHandler, { passive: true });
    window.addEventListener("resize", resizeHandler);

    onCleanup(() => {
      if (recollectTimer) window.clearTimeout(recollectTimer);
      if (rootPollTimer) window.clearInterval(rootPollTimer);
      if (positionTimer) window.clearInterval(positionTimer);
      if (observer) observer.disconnect();
      if (scrollHandler) window.removeEventListener("scroll", scrollHandler);
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
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

      const viewportMaxHeightPx = getViewportMaxHeightPx(maxVh());
      const measuredHeight = panel.getBoundingClientRect().height;
      setExpandedPanelHeightPx(Math.max(Math.floor(measuredHeight), MIN_RAIL_HEIGHT));
      if (!showExpandedPanel()) return;
      setRailHeightPx(clamp(Math.floor(measuredHeight), MIN_RAIL_HEIGHT, viewportMaxHeightPx));
    });
  });

  const renderExpandedPanel = () => (
    <Box
      ref={(el: HTMLElement) => (expandedPanelRef = el)}
      borderWidth="1px"
      borderColor="gray.outline.border"
      bg="bg.default"
      borderRadius="l2"
      boxShadow="lg"
      overflow="hidden"
      style={{
        width: `${panelWidthPx()}px`,
        "max-width": "min(320px, calc(100vw - 1rem))",
      }}
    >
      <Box
        as="nav"
        p="2"
        overflowY="scroll"
        ref={(el: HTMLElement) => {
          listScrollRef = el;
        }}
        style={{ "max-height": panelMaxHeight() }}
      >
        <Stack
          as="ul"
          gap="1"
          ref={(el: HTMLElement) => {
            listRef = el;
            if (showExpandedPanel()) {
              window.requestAnimationFrame(() => scrollListToActive("center"));
            }
          }}
        >
          <For each={items()}>
            {(item, i) => {
              const depth = () => getDisplayDepth(item.level);
              const paddingLeft = () => {
                const d = depth();
                if (d <= 0) return 0;
                if (d === 1) return 16;
                if (d === 2) return 28;
                return 36;
              };
              const isActive = () => i() === activeIndex();
              const indentStyle = () => {
                const px = paddingLeft();
                if (px <= 0) {
                  return { "margin-left": "0px", width: "100%" };
                }
                return {
                  "margin-left": `${px}px`,
                  width: `calc(100% - ${px}px)`,
                };
              };

              return (
                <Box as="li" data-toc-idx={i()} style={indentStyle()}>
                  <Button
                    type="button"
                    variant="plain"
                    size="xs"
                    colorPalette={isActive() ? "blue" : "gray"}
                    width="full"
                    justifyContent="flex-start"
                    pl="2"
                    pr="3"
                    py="1.5"
                    fontWeight={depth() <= 0 ? "semibold" : "normal"}
                    fontSize={depth() <= 1 ? "lg" : "md"}
                    borderTopWidth={i() === visibleStartIndex() ? "2px" : "0"}
                    borderTopColor="green.9"
                    borderBottomWidth={i() === visibleEndIndex() ? "2px" : "0"}
                    borderBottomColor="red.9"
                    bg={
                      i() >= visibleStartIndex() && i() <= visibleEndIndex()
                        ? "bg.subtle"
                        : "transparent"
                    }
                    _hover={{
                      bg: "bg.muted",
                      borderColor: "gray.outline.border",
                    }}
                    whiteSpace="normal"
                    textAlign="left"
                    minH="unset"
                    h="auto"
                    onClick={() => handleItemClick(item)}
                  >
                    {item.text || item.id}
                  </Button>
                </Box>
              );
            }}
          </For>
        </Stack>
      </Box>
    </Box>
  );

  const renderRail = () => (
    <Box
      position="relative"
      borderWidth="1px"
      borderColor="gray.outline.border"
      bg="bg.default"
      borderRadius="l2"
      p="1"
      boxShadow="sm"
      w="6"
      style={{
        height: `${collapsedRailHeightPx()}px`,
        transition: "height 220ms ease",
      }}
    >
      <Box
        position="absolute"
        left="1"
        right="1"
        h="2px"
        bg="green.9"
        opacity="1"
        style={{
          top: `${(visibleMarkerBounds().topRatio * 100).toFixed(1)}%`,
          transform: "translateY(-50%)",
        }}
      />
      <Box
        position="absolute"
        left="1"
        right="1"
        h="2px"
        bg="red.9"
        opacity="1"
        style={{
          top: `${(visibleMarkerBounds().bottomRatio * 100).toFixed(1)}%`,
          transform: "translateY(-50%)",
        }}
      />

      <Box position="absolute" top="3" bottom="3" left="1" right="1">
        <For each={markers()}>
          {(marker) => {
            const isActive = () => marker.index === activeIndex();
            const depth = () => getDisplayDepth(marker.item.level);
            const widthPx = () => {
              const d = depth();
              if (d <= 0) return 16;
              if (d === 1) return 12;
              if (d === 2) return 9;
              return 7;
            };
            const heightPx = () => {
              const d = depth();
              if (d <= 0) return 5;
              if (d <= 2) return 4;
              return 7;
            };
            const borderRadiusPx = () => {
              const d = depth();
              if (d <= 1) return 999;
              return 999;
            };
            const top = () => `${(marker.displayTopRatio * 100).toFixed(1)}%`;

            return (
              <Box
                position="absolute"
                left="50%"
                transform="translate(-50%, -50%)"
                style={{
                  top: top(),
                  width: `${widthPx()}px`,
                  height: `${heightPx()}px`,
                  "border-radius": `${borderRadiusPx()}px`,
                }}
                bg={isActive() ? "gray.12" : "gray.10"}
                borderWidth={isActive() ? "0px" : "1px"}
                borderColor="gray.4"
                opacity={isActive() ? "1" : "0.78"}
                cursor="pointer"
                onClick={() => handleItemClick(marker.item)}
              />
            );
          }}
        </For>
      </Box>
    </Box>
  );

  return (
    <Box
      position="fixed"
      zIndex="30"
      userSelect="none"
      class={props.class}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        left: `${panelLeftPx()}px`,
        top: `${containerTopPx()}px`,
        transition: "top 220ms ease",
      }}
    >
      <Box
        position="absolute"
        top="0"
        style={{
          left: `${panelOffsetPx()}px`,
          opacity: showExpandedPanel() ? "1" : "0",
          transform: showExpandedPanel() ? "translateX(0px)" : "translateX(14px)",
          transition: "transform 220ms ease, opacity 200ms ease",
          "pointer-events": showExpandedPanel() ? "auto" : "none",
        }}
      >
        {renderExpandedPanel()}
      </Box>

      <Show when={!showExpandedPanel()}>{renderRail()}</Show>
    </Box>
  );
};

export default TableOfContents;
