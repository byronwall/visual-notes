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

type TocItem = {
  id: string;
  text: string;
  level: 1 | 2 | 3;
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
  let listRef: HTMLUListElement | undefined;
  let lastSignature = ""; // used to detect real heading changes
  let recollectTimer: number | undefined;

  function collectHeadings(root: HTMLElement | null) {
    if (!root) {
      setItems([]);
      return;
    }
    const found = Array.from(
      root.querySelectorAll<HTMLElement>("h1, h2, h3")
    ).map((el) => {
      const tag = el.tagName.toLowerCase();
      const level = (tag === "h1" ? 1 : tag === "h2" ? 2 : 3) as 1 | 2 | 3;
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
      try {
        console.log("[TOC.collect] headings changed (", found.length, ")");
      } catch {}
      setItems(found);
      // Update active index immediately
      updateActiveIndex(found);
    }
  }

  // Debounced re-collect to avoid excessive work while editing
  function scheduleRecollect() {
    if (recollectTimer) window.clearTimeout(recollectTimer);
    recollectTimer = window.setTimeout(() => {
      collectHeadings(props.getRootEl());
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
    try {
      console.log(
        "[TOC.active] idx=",
        idx,
        "tops=",
        tops.map((t) => Math.round(t))
      );
    } catch {}
  }

  function findHeadingByLevelAndText(
    root: HTMLElement | null,
    level: 1 | 2 | 3,
    text: string
  ): HTMLElement | null {
    if (!root) return null;
    const tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
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
    try {
      console.log("[TOC.click] scroll to", {
        text: item.text,
        level: item.level,
        id: item.id,
        top,
      });
    } catch {}
    window.scrollTo({ top, behavior: "smooth" });
  }

  let observer: MutationObserver | undefined;
  let scrollHandler: (() => void) | undefined;
  let resizeHandler: (() => void) | undefined;

  onMount(() => {
    const root = props.getRootEl();
    collectHeadings(root);

    // // Observe heading changes inside the editor
    if (root) {
      observer = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        for (const m of mutations) {
          // Update when headings are added/removed or the mutated subtree might affect headings
          if (m.type === "childList") {
            const nodes = [
              ...Array.from(m.addedNodes),
              ...Array.from(m.removedNodes),
            ];
            if (
              nodes.some(
                (n) =>
                  n instanceof HTMLElement && /^(H1|H2|H3)$/.test(n.tagName)
              )
            ) {
              shouldUpdate = true;
              break;
            }
          }
        }
        if (shouldUpdate) scheduleRecollect();
      });
      // Only watch structure changes; attribute/character mutations are noisy.
      observer.observe(root, { childList: true, subtree: true });
    }

    scrollHandler = () => updateActiveIndex();
    resizeHandler = () => scheduleRecollect();
    window.addEventListener("scroll", scrollHandler, { passive: true });
    window.addEventListener("resize", resizeHandler);
  });

  onCleanup(() => {
    if (observer) observer.disconnect();
    if (scrollHandler) window.removeEventListener("scroll", scrollHandler);
    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
  });

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
    const container = listRef as unknown as HTMLElement | undefined;
    if (el && container) {
      const elTop = el.offsetTop;
      const elBottom = elTop + el.offsetHeight;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;
      const padding = 24;
      if (elTop < viewTop + padding) {
        try {
          console.log("[TOC.autoscroll] up to", elTop - padding);
        } catch {}
        container.scrollTo({ top: Math.max(elTop - padding, 0) });
      } else if (elBottom > viewBottom - padding) {
        const nextTop = elBottom - container.clientHeight + padding;
        try {
          console.log("[TOC.autoscroll] down to", nextTop);
        } catch {}
        container.scrollTo({ top: Math.max(nextTop, 0) });
      }
    }
  });

  return (
    <div
      class={`toc-container fixed right-4 top-24 z-30 select-none ${
        props.class || ""
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={containerStyle()}
    >
      <div class="flex items-start gap-3" style={{ height: "100%" }}>
        <Show when={expanded()}>
          <div
            class="w-72 rounded-lg border border-gray-200 bg-white shadow-lg"
            style={{ "max-height": `${maxVh()}vh`, overflow: "auto" }}
          >
            <div class="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700">
              Table of contents
            </div>
            <nav class="p-2">
              <ul class="flex flex-col" ref={(el) => (listRef = el)}>
                <For each={items()}>
                  {(it, i) => {
                    const handleClick = () => handleItemClick(it);
                    const paddingLeft =
                      it.level === 1 ? "0" : it.level === 2 ? "12px" : "24px";
                    const isActive = () => i() === activeIndex();
                    return (
                      <li data-toc-idx={i()}>
                        <button
                          class="w-full text-left px-3 py-1.5 rounded hover:bg-gray-100 focus:outline-none"
                          style={`padding-left: ${paddingLeft}; color: ${
                            isActive() ? "#2563eb" : "#374151"
                          }; font-weight: ${it.level === 1 ? "600" : "500"};`}
                          onClick={handleClick}
                        >
                          {it.text || it.id}
                        </button>
                      </li>
                    );
                  }}
                </For>
              </ul>
            </nav>
          </div>
        </Show>

        {/* Collapsed rail */}
        <div
          class="flex flex-col items-center gap-1 rounded-md border border-gray-200 bg-white/80 backdrop-blur p-2 shadow"
          style={{ height: "100%", overflow: "hidden" }}
        >
          <For each={items()}>
            {(it, i) => (
              <div
                class="w-3 rounded"
                style={{
                  height:
                    it.level === 1 ? "10px" : it.level === 2 ? "8px" : "6px",
                  background: i() === activeIndex() ? "#111827" : "#e5e7eb",
                  opacity: i() === activeIndex() ? 1 : 0.9,
                }}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  );
};

export default TableOfContents;
