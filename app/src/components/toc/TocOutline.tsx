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
import { toaster } from "~/components/ui/toast";
import {
  countClass,
  emptyClass,
  filterClass,
  inputClass,
  linkButtonClass,
  listClass,
  outlineClass,
  rowClass,
} from "./outline-styles";
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

const liClass = css({ position: "relative" });

function matchesQuery(text: string, query: string) {
  const lower = text.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => lower.includes(token));
}

/**
 * The note's headings as a readable outline: the current section is lit,
 * the list follows reading position, and the filter field searches headings
 * with arrow-key and Enter navigation. Shared by the pinned gutter outline,
 * the rail flyout, and the phone sheet.
 */
export function TocOutline(props: Props) {
  const [query, setQuery] = createSignal("");
  const [cursor, setCursor] = createSignal(-1);
  const [copiedIndex, setCopiedIndex] = createSignal(-1);
  const [fade, setFade] = createSignal<"top" | "bottom" | "both">();
  const [filterFocused, setFilterFocused] = createSignal(false);
  let listEl: HTMLUListElement | undefined;
  let inputEl: HTMLInputElement | undefined;
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
    if (!query().trim()) {
      return `${props.toc.activeIndex() + 1}/${props.toc.items().length}`;
    }
    const n = entries().length;
    if (n === 0) return "";
    return n === 1 ? "1 match" : `${n} matches`;
  };

  function updateFade() {
    if (!listEl) return;
    const { scrollTop, scrollHeight, clientHeight } = listEl;
    const above = scrollTop > 1;
    const below = scrollTop + clientHeight < scrollHeight - 1;
    setFade(
      above && below ? "both" : above ? "top" : below ? "bottom" : undefined,
    );
  }

  // Keep a row in the middle of the list, so the sections before and after
  // the current one stay in sight.
  function scrollRowIntoList(
    index: number,
    mode: "follow" | "center" | "nearest" = "follow",
  ) {
    const row = listEl?.querySelector<HTMLElement>(`[data-toc-idx="${index}"]`);
    if (!row || !listEl) return;
    const view = listEl.clientHeight;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (mode === "nearest") {
      // The keyboard cursor scrolls just enough, so the list moves with it.
      if (top < listEl.scrollTop + 8) listEl.scrollTop = Math.max(top - 8, 0);
      else if (bottom > listEl.scrollTop + view - 8) {
        listEl.scrollTop = bottom - view + 8;
      }
    } else {
      const band = view * 0.25;
      const outside =
        top < listEl.scrollTop + band ||
        bottom > listEl.scrollTop + view - band;
      if (mode === "center" || outside) {
        listEl.scrollTop = Math.max(top - (view - row.offsetHeight) / 3, 0);
      }
    }
    updateFade();
  }

  onMount(() =>
    window.requestAnimationFrame(() =>
      scrollRowIntoList(props.toc.activeIndex(), "center"),
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

  createEffect(on(entries, () => window.requestAnimationFrame(updateFade)));

  // The pinned outline's height follows the page scroll and the window,
  // so the fade follows them too.
  createEffect(
    on(
      () => [props.toc.pinnedTopPx(), props.toc.layout()],
      () => window.requestAnimationFrame(updateFade),
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
    scrollRowIntoList(next.index, "nearest");
  }

  function onFilterKeyDown(event: KeyboardEvent) {
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
      // The jump is done; show the whole outline around the new section.
      setQuery("");
      setCursor(-1);
    } else if (event.key === "Escape") {
      if (!query() && cursor() === -1) {
        inputEl?.blur();
        return;
      }
      event.stopPropagation();
      setQuery("");
      setCursor(-1);
    }
  }

  // Arrow keys move between rows once Tab has reached the list.
  function onListKeyDown(event: KeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const rows = Array.from(
      listEl?.querySelectorAll<HTMLElement>("[data-toc-row]") ?? [],
    );
    const at = rows.indexOf(document.activeElement as HTMLElement);
    if (at === -1) return;
    event.preventDefault();
    const next = event.key === "ArrowDown" ? at + 1 : at - 1;
    if (next < 0) inputEl?.focus();
    else rows[Math.min(next, rows.length - 1)].focus();
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
      toaster.create({
        title: "Could not copy link",
        description: url,
        type: "error",
      });
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
          ref={inputEl}
          type="search"
          class={inputClass}
          placeholder={filterFocused() ? "Filter headings" : "Contents"}
          aria-label="Filter headings"
          autocomplete="off"
          value={query()}
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            setCursor(-1);
            if (listEl) listEl.scrollTop = 0;
          }}
          onKeyDown={onFilterKeyDown}
          onFocus={() => setFilterFocused(true)}
          onBlur={() => {
            setFilterFocused(false);
            setCursor(-1);
          }}
        />
        <span class={countClass}>{countLabel()}</span>
      </label>

      <ul
        class={listClass}
        ref={listEl}
        data-fade={fade()}
        onScroll={updateFade}
        onKeyDown={onListKeyDown}
      >
        <For each={entries()}>
          {({ item, index }) => {
            const isActive = () => index === props.toc.activeIndex();
            const copied = () => copiedIndex() === index;
            return (
              <li data-toc-idx={index} class={liClass}>
                <button
                  type="button"
                  class={rowClass}
                  data-toc-row
                  data-depth={depth(item)}
                  data-active={isActive()}
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
                  {/* Out of the tab order: Tab and arrows walk the headings. */}
                  <button
                    type="button"
                    tabIndex={-1}
                    class={linkButtonClass}
                    data-copied={copied() ? "true" : undefined}
                    aria-label={`Copy link to “${item.text}”`}
                    onClick={() => void copyLink(item, index)}
                  >
                    <Show when={copied()} fallback={<LinkIcon size={12} />}>
                      <CheckIcon size={12} />
                    </Show>
                  </button>
                </Show>
              </li>
            );
          }}
        </For>
        <Show when={entries().length === 0}>
          <li class={emptyClass}>
            No headings match “{query().trim()}”. Esc clears the filter.
          </li>
        </Show>
      </ul>
    </nav>
  );
}
