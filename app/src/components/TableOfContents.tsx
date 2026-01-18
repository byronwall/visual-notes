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
import { Text } from "~/components/ui/text";
import { Box, HStack, Stack } from "styled-system/jsx";

type TocItem = {
  id: string;
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  el: HTMLElement;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export const TableOfContents: VoidComponent<{
  getRootEl: () => HTMLElement | null;
  class?: string;
  maxVh?: number; // default 60
}> = (props) => {
  const maxVh = () => props.maxVh ?? 60;

  const [items, setItems] = createSignal<TocItem[]>([]);
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [expanded, setExpanded] = createSignal(false);
  const minHeadingLevel = createMemo(() => {
    const lvls = items().map((it) => it.level);
    if (lvls.length === 0) return 1;
    return Math.min(...lvls) as TocItem["level"];
  });
  let listRef: HTMLElement | undefined;
  let lastSignature = ""; // used to detect real heading changes
  let recollectTimer: number | undefined;
  let observedRoot: HTMLElement | null = null;
  let observer: MutationObserver | undefined;
  let scrollHandler: (() => void) | undefined;
  let resizeHandler: (() => void) | undefined;
  let rootPollTimer: number | undefined;
  let lastMutationLogAt = 0;

  function getDisplayDepth(level: TocItem["level"]) {
    // Normalize indentation so docs that start at h2/h3 still render as top-level.
    // Example: if the minimum heading is h2, then h2 depth=0, h3 depth=1, etc.
    const depth = level - minHeadingLevel();
    return Math.max(depth, 0);
  }

  function collectHeadings(root: HTMLElement | null) {
    if (!root) {
      setItems([]);
      return;
    }
    const found = Array.from(
      root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")
    ).map((el) => {
      const tag = el.tagName.toLowerCase();
      const parsedLevel = Number(tag.slice(1));
      const level = (
        parsedLevel >= 1 && parsedLevel <= 6 ? parsedLevel : 1
      ) as TocItem["level"];
      const text = (el.textContent || "").trim();
      // Avoid mutating the ProseMirror DOM (setting el.id causes constant attribute churn).
      // Generate a stable id for TOC use only.
      const id =
        el.id ||
        slugify(text || `section-${Math.random().toString(36).slice(2, 8)}`);
      return { id, text, level, el } as TocItem;
    });

    const signature = found
      .map((f) => `${f.level}:${f.id}:${f.text}`)
      .join("|");

    if (signature !== lastSignature) {
      lastSignature = signature;
      const levels = found.map((f) => f.level);
      const min = levels.length ? Math.min(...levels) : null;
      const max = levels.length ? Math.max(...levels) : null;
      console.log("[TOC.collect] headings changed", {
        count: found.length,
        minLevel: min,
        maxLevel: max,
        rootTag: root.tagName,
        rootClass: root.className,
      });
      setItems(found);
      // Update active index immediately
      updateActiveIndex(found);
    }
  }

  function bindRoot(nextRoot: HTMLElement | null, reason: string) {
    if (nextRoot === observedRoot) return;

    console.log("[TOC.bind] root change", {
      reason,
      from: observedRoot
        ? { tag: observedRoot.tagName, class: observedRoot.className }
        : null,
      to: nextRoot
        ? { tag: nextRoot.tagName, class: nextRoot.className }
        : null,
    });

    observedRoot = nextRoot;
    lastSignature = "";
    if (observer) observer.disconnect();

    if (!nextRoot) {
      setItems([]);
      setActiveIndex(0);
      return;
    }

    collectHeadings(nextRoot);

    observer = new MutationObserver((mutations) => {
      // Helpful when debugging navigation/async render behavior; throttle to avoid log spam.
      const now = Date.now();
      if (now - lastMutationLogAt > 750) {
        lastMutationLogAt = now;
        console.log("[TOC.mutation] observed", {
          mutationCount: mutations.length,
          rootTag: observedRoot?.tagName,
          rootClass: observedRoot?.className,
        });
      }

      // Headings can arrive inside newly-added subtrees (e.g. ProseMirror mounts a wrapper div).
      // Recollect is debounced, so it's OK to be a bit eager here.
      scheduleRecollect();
    });

    // Only watch structure changes; attribute/character mutations are noisy.
    observer.observe(nextRoot, { childList: true, subtree: true });
  }

  // Debounced re-collect to avoid excessive work while editing
  function scheduleRecollect() {
    if (recollectTimer) window.clearTimeout(recollectTimer);
    recollectTimer = window.setTimeout(() => {
      const root = props.getRootEl();
      // If navigation changed the underlying DOM but our root tracking didn't catch it,
      // this will re-bind to the current element.
      bindRoot(root, "recollect");
      collectHeadings(root);
    }, 250);
  }

  function updateActiveIndex(currentItems?: TocItem[]) {
    const list = currentItems ?? items();
    if (list.length === 0) {
      setActiveIndex(0);
      return;
    }

    const offset = 80 + 1; // switch when heading reaches the top of the viewport

    const resolveEl = (it: TocItem): HTMLElement | null => {
      // Prefer current DOM by id; then tag+text; fallback to stored element
      const byId = document.getElementById(it.id);
      if (byId) return byId;
      const root = props.getRootEl();
      const byText = findHeadingByLevelAndText(root, it.level, it.text);
      if (byText) return byText;
      return it.el || null;
    };

    const tops = list.map((it) => {
      const el = resolveEl(it);
      return el ? el.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
    });

    let firstAfter = tops.findIndex((t) => t - offset > 0);
    let idx: number;
    if (firstAfter === -1) {
      // All headings are above the threshold → last is active
      idx = list.length - 1;
    } else if (firstAfter === 0) {
      idx = 0;
    } else {
      idx = firstAfter - 1;
    }

    if (idx < 0 || idx >= list.length) idx = 0;
    setActiveIndex(idx);
  }

  function findHeadingByLevelAndText(
    root: HTMLElement | null,
    level: 1 | 2 | 3 | 4 | 5 | 6,
    text: string
  ): HTMLElement | null {
    if (!root) return null;
    const tag = `h${level}`;
    const nodes = root.querySelectorAll<HTMLElement>(tag);
    const targetText = (text || "").trim();
    for (const el of Array.from(nodes)) {
      const elText = (el.textContent || "").trim();
      if (elText === targetText) return el;
    }
    return null;
  }

  function handleItemClick(item: TocItem) {
    const root = props.getRootEl();
    // 1) Prefer tag+text match for robustness
    let target = findHeadingByLevelAndText(root, item.level, item.text);
    // 2) Fallback to id lookup
    if (!target) target = document.getElementById(item.id);
    // 3) Final fallback to captured element reference
    if (!target) target = item.el;
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 80; // nudge up a bit
    console.log("[TOC.click] scroll to", {
      text: item.text,
      level: item.level,
      id: item.id,
      top,
    });
    window.scrollTo({ top, behavior: "smooth" });
  }

  onMount(() => {
    // Root element comes from outside (non-reactive), so we poll a bit to handle:
    // - async doc load
    // - ref assignment timing
    // - client-side navigation DOM swaps
    bindRoot(props.getRootEl(), "mount");
    rootPollTimer = window.setInterval(() => {
      bindRoot(props.getRootEl(), "poll");
    }, 300);

    scrollHandler = () => updateActiveIndex();
    resizeHandler = () => scheduleRecollect();
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

  // Note: we intentionally avoid relying on `createEffect` for root changes because
  // `getRootEl()` is typically not reactive (it reads from refs / DOM).

  const handleMouseEnter = () => setExpanded(true);
  const handleMouseLeave = () => setExpanded(false);

  const containerStyle = createMemo(() => ({
    "max-height": `${maxVh()}vh`,
  }));

  // Keep the active item visible inside the expanded list while scrolling
  createEffect(() => {
    if (!expanded()) return; // only when panel is visible
    const idx = activeIndex();
    const el = listRef?.querySelector(
      `[data-toc-idx="${idx}"]`
    ) as HTMLElement | null;
    const container = listRef;
    if (el && container) {
      const elTop = el.offsetTop;
      const elBottom = elTop + el.offsetHeight;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;
      const padding = 24;
      if (elTop < viewTop + padding) {
        console.log("[TOC.autoscroll] up to", elTop - padding);
        container.scrollTo({ top: Math.max(elTop - padding, 0) });
      } else if (elBottom > viewBottom - padding) {
        const nextTop = elBottom - container.clientHeight + padding;
        console.log("[TOC.autoscroll] down to", nextTop);
        container.scrollTo({ top: Math.max(nextTop, 0) });
      }
    }
  });

  return (
    <Box
      position="fixed"
      right="4"
      top="24"
      zIndex="30"
      userSelect="none"
      class={props.class}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={containerStyle()}
    >
      <HStack gap="3" alignItems="flex-start" h="100%">
        <Show when={expanded()}>
          <Box
            w="18rem"
            borderWidth="1px"
            borderColor="gray.outline.border"
            bg="bg.default"
            borderRadius="l2"
            boxShadow="lg"
            overflow="auto"
            style={{ "max-height": `${maxVh()}vh` }}
          >
            <Box
              position="sticky"
              top="0"
              zIndex="10"
              borderBottomWidth="1px"
              borderColor="gray.outline.border"
              bg="bg.default"
              px="4"
              py="2"
            >
              <Text textStyle="sm" fontWeight="semibold" color="fg.muted">
                Table of contents
              </Text>
            </Box>
            <Box as="nav" p="2">
              <Stack as="ul" gap="1" ref={(el: HTMLElement) => (listRef = el)}>
                <For each={items()}>
                  {(it, i) => {
                    const handleClick = () => handleItemClick(it);
                    const depth = () => getDisplayDepth(it.level);
                    const paddingLeft = () => {
                      const d = depth();
                      if (d <= 0) return "0";
                      if (d === 1) return "0.75rem";
                      return "1.5rem";
                    };
                    const isActive = () => i() === activeIndex();
                    return (
                      <Box as="li" data-toc-idx={i()}>
                        <Button
                          type="button"
                          variant="plain"
                          size="xs"
                          colorPalette={isActive() ? "blue" : "gray"}
                          width="full"
                          justifyContent="flex-start"
                          pl={paddingLeft()}
                          pr="3"
                          py="1.5"
                          fontWeight={depth() <= 0 ? "semibold" : "medium"}
                          onClick={handleClick}
                        >
                          {it.text || it.id}
                        </Button>
                      </Box>
                    );
                  }}
                </For>
              </Stack>
            </Box>
          </Box>
        </Show>

        {/* Collapsed rail */}
        <Stack
          alignItems="center"
          gap="1"
          borderWidth="1px"
          borderColor="gray.outline.border"
          bg="bg.default"
          borderRadius="l2"
          p="2"
          boxShadow="sm"
          h="100%"
          overflow="hidden"
        >
          <For each={items()}>
            {(it, i) => {
              const depth = () => getDisplayDepth(it.level);
              const barHeight = () => {
                const d = depth();
                if (d <= 0) return "10px";
                if (d === 1) return "8px";
                return "6px";
              };
              return (
                <Box
                  w="3"
                  borderRadius="sm"
                  h={barHeight()}
                  bg={i() === activeIndex() ? "fg.default" : "border"}
                  opacity={i() === activeIndex() ? 1 : 0.9}
                />
              );
            }}
          </For>
        </Stack>
      </HStack>
    </Box>
  );
};

export default TableOfContents;
