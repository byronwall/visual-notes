import {
  For,
  Show,
  createEffect,
  createMemo,
  onCleanup,
  onMount,
} from "solid-js";
import { css } from "styled-system/css";
import { pathToRoute } from "~/utils/path-links";

type PathDiscoveryData = {
  recentlyViewed: { path: string; count: number; lastViewedAt?: string }[];
  highCount: { path: string; count: number }[];
};

// One line only: items that do not fit wrap onto hidden lines instead of
// pushing the list down or scrolling sideways.
const rowClass = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  columnGap: "4",
  h: "6",
  overflow: "hidden",
  fontSize: "xs",
});

const labelClass = css({
  color: "fg.subtle",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  h: "6",
  _hover: { color: "fg.default" },
});

const pathClass = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  h: "6",
  fontFamily: "mono",
  color: "fg.muted",
  textDecoration: "none",
  whiteSpace: "nowrap",
  _hover: { color: "fg.default", textDecoration: "underline" },
  "& .count": { color: "fg.subtle" },
});

export const PathDiscoveryLinks = (props: { data?: PathDiscoveryData }) => {
  const merged = createMemo(() => {
    const ordered = [
      ...(props.data?.recentlyViewed || []),
      ...(props.data?.highCount || []),
    ];
    const seen = new Set<string>();
    const out: { path: string; count: number }[] = [];
    for (const item of ordered) {
      if (!item.path || seen.has(item.path)) continue;
      seen.add(item.path);
      out.push({ path: item.path, count: item.count });
      if (out.length >= 12) break;
    }
    return out;
  });

  // Links that wrap onto the clipped lines stay out of view and tab order.
  let nav: HTMLElement | undefined;
  const hideWrapped = () => {
    if (!nav) return;
    const top = nav.offsetTop;
    for (const el of Array.from(nav.children) as HTMLElement[]) {
      el.style.visibility = el.offsetTop > top + 4 ? "hidden" : "";
    }
  };
  onMount(() => {
    if (!nav || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(hideWrapped);
    observer.observe(nav);
    onCleanup(() => observer.disconnect());
  });
  createEffect(() => {
    merged();
    queueMicrotask(hideWrapped);
  });

  return (
    <nav ref={nav} class={rowClass} aria-label="Frequent paths">
      <a href="/path" class={labelClass}>
        Paths
      </a>
      <Show when={merged().length > 0}>
        <For each={merged()}>
          {(item) => (
            <a href={pathToRoute(item.path)} class={pathClass}>
              {item.path}
              <span class="count">{item.count}</span>
            </a>
          )}
        </For>
      </Show>
    </nav>
  );
};
