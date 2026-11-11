import { createEffect, createSignal, on, onCleanup, onMount } from "solid-js";

const GAP = 4;

/**
 * Which tabs fit on one line. Tabs that do not fit stay mounted but hidden, so
 * they can still be measured; the active tab is always kept. The server and
 * the first client render show every tab on a clipped line, then this trims.
 */
export function useOverflowTabs(opts: {
  ids: () => string[];
  activeId: () => string | undefined;
}) {
  const tabs = new Map<string, HTMLElement>();
  let list: HTMLElement | undefined;
  let more: HTMLElement | undefined;
  let extra: HTMLElement | undefined;
  const [hidden, setHidden] = createSignal<string[]>([]);

  const measure = () => {
    const avail = list?.clientWidth ?? 0;
    // Hidden by the narrow layout: keep the last result.
    if (!avail) return;
    const width = (id: string) => (tabs.get(id)?.offsetWidth ?? 0) + GAP;
    const ids = opts.ids();
    const active = opts.activeId();
    const extraW = (extra?.offsetWidth ?? 0) + GAP;
    const total = ids.reduce((sum, id) => sum + width(id), extraW);
    if (total <= avail) {
      if (hidden().length) setHidden([]);
      return;
    }
    const budget = avail - extraW - (more?.offsetWidth ?? 0) - GAP;
    let used = active ? width(active) : 0;
    const shown = new Set(active ? [active] : []);
    for (const id of ids) {
      if (id === active) continue;
      if (used + width(id) > budget) break;
      shown.add(id);
      used += width(id);
    }
    const next = ids.filter((id) => !shown.has(id));
    if (next.join() !== hidden().join()) setHidden(next);
  };

  onMount(() => {
    const ro = new ResizeObserver(() => measure());
    if (list) ro.observe(list);
    onCleanup(() => ro.disconnect());
  });
  // Names, order and the active view change tab widths after render.
  createEffect(
    on([opts.ids, opts.activeId], () => queueMicrotask(measure), {
      defer: false,
    }),
  );

  return {
    hidden,
    isHidden: (id: string) => hidden().includes(id),
    remeasure: () => queueMicrotask(measure),
    tabRef: (id: string) => (el: HTMLElement) => {
      tabs.set(id, el);
      onCleanup(() => tabs.get(id) === el && tabs.delete(id));
    },
    listRef: (el: HTMLElement) => (list = el),
    moreRef: (el: HTMLElement) => (more = el),
    /** The active view's options button, which sits inside the strip. */
    extraRef: (el: HTMLElement) => (extra = el),
  };
}
