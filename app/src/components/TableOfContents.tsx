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
import { Button } from "~/components/ui/button";
import { Box, Stack } from "styled-system/jsx";

type TocItem = {
  id: string;
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
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
  showExpandedByDefault: boolean;
};

const DEFAULT_MAX_VH = 72;
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
  return `min(calc(100vh - 1.5rem), ${maxVh}vh)`;
}

function extractTocItems(root: HTMLElement): TocItem[] {
  const mapped = Array.from(
    root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")
  ).map((el, index) => {
    const tag = el.tagName.toLowerCase();
    const parsedLevel = Number(tag.slice(1));
    const level = (parsedLevel >= 1 && parsedLevel <= 6 ? parsedLevel : 1) as TocItem["level"];
    const text = (el.textContent || "").trim();
    const id = el.id || slugify(text) || `section-${level}-${index + 1}`;
    return { id, text, level, el } as TocItem;
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
  text: string
): HTMLElement | null {
  if (!root) return null;
  const nodes = root.querySelectorAll<HTMLElement>(`h${level}`);
  const targetText = (text || "").trim();
  for (const el of Array.from(nodes)) {
    if ((el.textContent || "").trim() === targetText) return el;
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

  const rightPanelRoom = window.innerWidth - VIEWPORT_PADDING - desiredPanelLeft;
  const showExpandedByDefault = rightPanelRoom >= panelWidthPx && rightPanelRoom >= IDEAL_PANEL_WIDTH;

  const viewportMaxHeightPx = getViewportMaxHeightPx(maxVh);
  const railHeightPx = clamp(20 + itemCount * 32, MIN_RAIL_HEIGHT, viewportMaxHeightPx);

  return {
    panelLeftPx: railLeft,
    panelWidthPx,
    panelOffsetPx: clampedPanelLeft - railLeft,
    railHeightPx,
    showExpandedByDefault,
  };
}

function resolveActiveRange(tops: number[]) {
  if (tops.length === 0) {
    return { startIdx: 0, endIdx: 0 };
  }

  const topOffset = 81;
  const firstAfterTop = tops.findIndex((t) => t - topOffset > 0);

  let startIdx = 0;
  if (firstAfterTop === -1) {
    startIdx = tops.length - 1;
  } else if (firstAfterTop === 0) {
    startIdx = 0;
  } else {
    startIdx = firstAfterTop - 1;
  }

  const bottomOffset = window.innerHeight - 24;
  const firstAfterBottom = tops.findIndex((t) => t > bottomOffset);

  let endIdx = 0;
  if (firstAfterBottom === -1) {
    endIdx = tops.length - 1;
  } else if (firstAfterBottom === 0) {
    endIdx = 0;
  } else {
    endIdx = firstAfterBottom - 1;
  }

  if (endIdx < startIdx) endIdx = startIdx;
  if (endIdx >= tops.length) endIdx = tops.length - 1;

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

  const showExpandedPanel = createMemo(
    () => showExpandedByDefault() || isHoverExpanded()
  );

  const minHeadingLevel = createMemo(() => {
    const levels = items().map((it) => it.level);
    if (levels.length === 0) return 1;
    return Math.min(...levels) as TocItem["level"];
  });

  const panelMaxHeight = createMemo(() => getPanelMaxHeightCss(maxVh()));

  let listRef: HTMLElement | undefined;
  let expandedPanelRef: HTMLElement | undefined;

  let lastSignature = "";
  let observedRoot: HTMLElement | null = null;
  let observer: MutationObserver | undefined;
  let recollectTimer: number | undefined;
  let rootPollTimer: number | undefined;
  let scrollHandler: (() => void) | undefined;
  let resizeHandler: (() => void) | undefined;

  function getDisplayDepth(level: TocItem["level"]) {
    const depth = level - minHeadingLevel();
    return Math.max(depth, 0);
  }

  function resolveHeadingEl(item: TocItem): HTMLElement | null {
    const byId = document.getElementById(item.id);
    if (byId) return byId;

    const root = props.getRootEl();
    const byText = findHeadingByLevelAndText(root, item.level, item.text);
    if (byText) return byText;

    return item.el || null;
  }

  function resetLayoutState() {
    setPanelLeftPx(DEFAULT_PANEL_LEFT);
    setPanelWidthPx(DEFAULT_PANEL_WIDTH);
    setPanelOffsetPx(DEFAULT_PANEL_OFFSET);
    setRailHeightPx(DEFAULT_RAIL_HEIGHT);
    setShowExpandedByDefault(false);
    setIsHoverExpanded(false);
  }

  function refreshLayoutMode() {
    const root = props.getRootEl();
    if (!root) {
      resetLayoutState();
      return;
    }

    const layout = computeTocLayout(root, maxVh(), items().length);

    setPanelLeftPx(layout.panelLeftPx);
    setPanelWidthPx(layout.panelWidthPx);
    setPanelOffsetPx(layout.panelOffsetPx);
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

    const tops = list.map((item) => {
      const el = resolveHeadingEl(item);
      return el ? el.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
    });

    const range = resolveActiveRange(tops);
    setActiveIndex(range.startIdx);
    setVisibleStartIndex(range.startIdx);
    setVisibleEndIndex(range.endIdx);
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

  const markers = createMemo<TocMarker[]>(() => {
    const list = items();
    if (list.length === 0) return [];

    const root = props.getRootEl();
    if (!root) {
      const fallbackSpan = 1 / list.length;
      return list.map((item, index) => ({
        item,
        index,
        topRatio: list.length === 1 ? 0 : index / (list.length - 1),
        displayTopRatio: list.length === 1 ? 0.5 : index / (list.length - 1),
        spanRatio: fallbackSpan,
      }));
    }

    const rootTop = root.getBoundingClientRect().top + window.scrollY;
    const docHeight = Math.max(root.scrollHeight, 1);

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

    return list.map((item, index) => ({
      item,
      index,
      topRatio: clamp(headingTops[index] / docHeight, 0, 1),
      // Keep markers readable while still hinting relative section lengths.
      displayTopRatio: clamp(
        (list.length === 1 ? 0.5 : index / (list.length - 1)) * 0.72 +
          clamp(headingTops[index] / docHeight, 0, 1) * 0.28,
        0.03,
        0.97
      ),
      spanRatio: clamp(rawSpans[index] / spanTotal, 0.02, 0.35),
    }));
  });

  onMount(() => {
    bindRoot(props.getRootEl());
    refreshLayoutMode();

    rootPollTimer = window.setInterval(() => {
      bindRoot(props.getRootEl());
    }, 300);

    scrollHandler = () => updateActiveIndex();
    resizeHandler = () => {
      scheduleRecollect();
      refreshLayoutMode();
    };

    window.addEventListener("scroll", scrollHandler, { passive: true });
    window.addEventListener("resize", resizeHandler);

    onCleanup(() => {
      if (recollectTimer) window.clearTimeout(recollectTimer);
      if (rootPollTimer) window.clearInterval(rootPollTimer);
      if (observer) observer.disconnect();
      if (scrollHandler) window.removeEventListener("scroll", scrollHandler);
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    });
  });

  createEffect(() => {
    if (!showExpandedPanel()) return;

    const idx = activeIndex();
    const el = listRef?.querySelector(`[data-toc-idx="${idx}"]`) as HTMLElement | null;
    const container = listRef;
    if (!el || !container) return;

    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    const padding = 24;

    if (elTop < viewTop + padding) {
      container.scrollTo({ top: Math.max(elTop - padding, 0) });
      return;
    }

    if (elBottom > viewBottom - padding) {
      const nextTop = elBottom - container.clientHeight + padding;
      container.scrollTo({ top: Math.max(nextTop, 0) });
    }
  });

  createEffect(() => {
    if (!showExpandedPanel()) return;

    panelWidthPx();
    items().length;
    window.requestAnimationFrame(() => {
      const panel = expandedPanelRef;
      if (!panel) return;

      const viewportMaxHeightPx = getViewportMaxHeightPx(maxVh());
      const measuredHeight = panel.getBoundingClientRect().height;
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
      <Box as="nav" p="2" overflowY="scroll" style={{ "max-height": panelMaxHeight() }}>
        <Stack as="ul" gap="1" ref={(el: HTMLElement) => (listRef = el)}>
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
      style={{ height: `${railHeightPx()}px` }}
    >
      <Box position="absolute" top="1" left="1" right="1" h="2px" bg="green.9" opacity="1" />
      <Box position="absolute" bottom="1" left="1" right="1" h="2px" bg="red.9" opacity="1" />

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
      top="3"
      zIndex="30"
      userSelect="none"
      class={props.class}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ left: `${panelLeftPx()}px` }}
    >
      <Show when={showExpandedPanel()}>
        <Box position="absolute" top="0" style={{ left: `${panelOffsetPx()}px` }}>
          {renderExpandedPanel()}
        </Box>
      </Show>

      <Show when={!showExpandedPanel()}>{renderRail()}</Show>
    </Box>
  );
};

export default TableOfContents;
