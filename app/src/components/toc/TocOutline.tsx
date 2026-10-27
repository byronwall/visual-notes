import {
  For,
  Show,
  type JSX,
  createEffect,
  createMemo,
  createSignal,
  on,
  onMount,
} from "solid-js";
import { CheckIcon, LinkIcon, SearchIcon } from "lucide-solid";
import { css, cx } from "styled-system/css";
import { HighlightMatch } from "~/components/archive/list/HighlightMatch";
import { type TocItem } from "./types";
import { type TocController } from "./useTocController";

type Props = {
  toc: TocController;
  /** Larger rows for the phone sheet; also drops the hover-only link action. */
  touch?: boolean;
  /** Replaces the default jump, e.g. to close the sheet first. */
  onSelect?: (item: TocItem) => void;
  class?: string;
  style?: JSX.CSSProperties;
};

const outlineClass = css({
  display: "flex",
  flexDirection: "column",
  minH: "0",
  gap: "0.5",
});

const filterClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  flexShrink: 0,
  h: "8",
  px: "2",
  borderRadius: "l2",
  color: "fg.subtle",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "bg.hover" },
  _focusWithin: { bg: "bg.muted", color: "fg.muted" },
});

const inputClass = css({
  flex: "1",
  minW: "0",
  h: "full",
  bg: "transparent",
  border: "none",
  outline: "none",
  fontSize: "sm",
  color: "fg.default",
  _placeholder: { color: "fg.subtle" },
  "&::-webkit-search-cancel-button": { display: "none" },
});

const countClass = css({
  flexShrink: 0,
  fontSize: "xs",
  color: "fg.subtle",
  fontVariantNumeric: "tabular-nums",
});

const listClass = css({
  position: "relative",
  flex: "1",
  minH: "0",
  overflowY: "auto",
  overscrollBehavior: "contain",
  scrollbarWidth: "thin",
  listStyle: "none",
  m: "0",
  p: "0",
});

const rowClass = css({
  display: "block",
  w: "full",
  textAlign: "left",
  py: "1",
  pr: "7",
  borderRadius: "l2",
  fontSize: "sm",
  lineHeight: "1.35",
  color: "fg.muted",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "bg.hover", color: "fg.default" },
  _active: { bg: "bg.active" },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "border.focus",
    outlineOffset: "-2px",
  },
  "&[data-depth='0']": { fontWeight: "medium" },
  "&[data-inview=true]": { color: "fg.default" },
  "&[data-cursor=true]": { bg: "bg.hover", color: "fg.default" },
  "&[data-active=true]": { bg: "bg.selected", color: "fg.default" },
  "&[data-touch=true]": { py: "2.5", pr: "3", fontSize: "md" },
  _motionReduce: { transition: "none" },
});

const linkButtonClass = css({
  position: "absolute",
  top: "1",
  right: "1",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  w: "5",
  h: "5",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  opacity: "0",
  transitionProperty: "opacity, background-color, color, transform",
  transitionDuration: "140ms",
  "li:hover > &": { opacity: "1" },
  "&:focus-visible, &[data-copied=true]": { opacity: "1" },
  _hover: { bg: "gray.a4", color: "fg.default" },
  _active: { transform: "scale(0.9)" },
  "&[data-copied=true]": { color: "fg.success" },
  _motionReduce: { transition: "none" },
});

const emptyClass = css({
  px: "2",
  py: "1.5",
  fontSize: "sm",
  color: "fg.subtle",
});

function matchesQuery(text: string, query: string) {
  const lower = text.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => lower.includes(token));
}

/**
 * The note's headings as a readable outline: the section in view is lit,
 * the list follows reading position, and the filter field searches headings
 * with arrow-key and Enter navigation. Shared by the pinned gutter outline,
 * the rail flyout, and the phone sheet.
 */
export function TocOutline(props: Props) {
  const [query, setQuery] = createSignal("");
  const [cursor, setCursor] = createSignal(-1);
  const [copiedIndex, setCopiedIndex] = createSignal(-1);
  let listEl: HTMLUListElement | undefined;
  let copiedTimer: number | undefined;

  const entries = createMemo(() => {
    const q = query().trim();
    return props.toc
      .items()
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !q || matchesQuery(item.text, q));
  });

  const depth = (item: TocItem) =>
    Math.min(Math.max(item.level - props.toc.minHeadingLevel(), 0), 3);

  const countLabel = () => {
    if (query().trim()) {
      const n = entries().length;
      return n === 1 ? "1 match" : `${n} matches`;
    }
    return `${props.toc.activeIndex() + 1}/${props.toc.items().length}`;
  };

  function scrollRowIntoList(index: number, center = false) {
    const row = listEl?.querySelector<HTMLElement>(`[data-toc-idx="${index}"]`);
    if (!row || !listEl) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    const view = listEl.clientHeight;
    if (center) {
      listEl.scrollTop = Math.max(top - (view - row.offsetHeight) / 2, 0);
    } else if (top < listEl.scrollTop + 8) {
      listEl.scrollTop = Math.max(top - 8, 0);
    } else if (bottom > listEl.scrollTop + view - 8) {
      listEl.scrollTop = bottom - view + 8;
    }
  }

  onMount(() =>
    window.requestAnimationFrame(() =>
      scrollRowIntoList(props.toc.activeIndex(), true),
    ),
  );

  // Follow the reader, but leave the list alone while they filter it.
  createEffect(
    on(
      () => props.toc.activeIndex(),
      (index) => {
        if (query().trim()) return;
        window.requestAnimationFrame(() => scrollRowIntoList(index));
      },
    ),
  );

  function jump(item: TocItem) {
    if (props.onSelect) props.onSelect(item);
    else props.toc.onItemClick(item);
  }

  function moveCursor(step: 1 | -1) {
    const list = entries();
    if (list.length === 0) return;
    let pos = list.findIndex((entry) => entry.index === cursor());
    if (pos === -1) {
      const active = list.findIndex(
        (entry) => entry.index >= props.toc.activeIndex(),
      );
      pos = step === 1 ? Math.max(active, 0) - 1 : Math.max(active, 0) + 1;
    }
    const next = list[Math.min(Math.max(pos + step, 0), list.length - 1)];
    setCursor(next.index);
    scrollRowIntoList(next.index);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveCursor(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter") {
      const list = entries();
      const target =
        list.find((entry) => entry.index === cursor()) ??
        (query().trim() ? list[0] : undefined);
      if (!target) return;
      event.preventDefault();
      jump(target.item);
    } else if (event.key === "Escape") {
      if (!query() && cursor() === -1) {
        (event.currentTarget as HTMLInputElement).blur();
        return;
      }
      event.stopPropagation();
      setQuery("");
      setCursor(-1);
    }
  }

  async function copyLink(item: TocItem, index: number) {
    if (!item.blockId) return;
    const url = `${window.location.origin}${window.location.pathname}#b-${item.blockId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedIndex(index);
      window.clearTimeout(copiedTimer);
      copiedTimer = window.setTimeout(() => setCopiedIndex(-1), 1400);
    } catch (error) {
      console.warn("[toc] clipboard write failed", error);
    }
  }

  return (
    <nav
      aria-label="Contents"
      class={cx(outlineClass, props.class)}
      style={props.style}
    >
      <label class={filterClass}>
        <SearchIcon size={14} aria-hidden="true" />
        <input
          type="search"
          class={inputClass}
          placeholder="Contents"
          aria-label="Filter headings"
          value={query()}
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            setCursor(-1);
            if (listEl) listEl.scrollTop = 0;
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setCursor(-1)}
        />
        <span class={countClass}>{countLabel()}</span>
      </label>

      <ul class={listClass} ref={listEl}>
        <For each={entries()}>
          {({ item, index }) => {
            const isActive = () => index === props.toc.activeIndex();
            const inView = () =>
              index >= props.toc.visibleStartIndex() &&
              index <= props.toc.visibleEndIndex();
            return (
              <li data-toc-idx={index} class={css({ position: "relative" })}>
                <button
                  type="button"
                  class={rowClass}
                  data-depth={depth(item)}
                  data-active={isActive()}
                  data-inview={inView()}
                  data-cursor={index === cursor()}
                  data-touch={props.touch ? "true" : undefined}
                  aria-current={isActive() ? "location" : undefined}
                  style={{
                    "padding-left": `${(props.touch ? 12 : 8) + depth(item) * (props.touch ? 14 : 12)}px`,
                  }}
                  onClick={() => jump(item)}
                >
                  <HighlightMatch
                    text={item.text || "Untitled section"}
                    query={query()}
                  />
                </button>
                <Show when={!props.touch && item.blockId}>
                  <button
                    type="button"
                    class={linkButtonClass}
                    data-copied={copiedIndex() === index}
                    aria-label={`Copy link to “${item.text}”`}
                    onClick={() => void copyLink(item, index)}
                  >
                    <Show
                      when={copiedIndex() === index}
                      fallback={<LinkIcon size={12} />}
                    >
                      <CheckIcon size={12} />
                    </Show>
                  </button>
                </Show>
              </li>
            );
          }}
        </For>
        <Show when={entries().length === 0}>
          <li class={emptyClass}>No heading matches “{query().trim()}”</li>
        </Show>
      </ul>
    </nav>
  );
}
