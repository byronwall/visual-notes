import { SearchIcon, XIcon } from "lucide-solid";
import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import type { PathNoteSort } from "../hooks/usePathViewParams";

const toolbarClass = css({
  display: "flex",
  alignItems: "center",
  gap: "3",
  flexWrap: "wrap",
});

const searchWrapClass = css({
  position: "relative",
  display: "flex",
  alignItems: "center",
  flex: "1 1 240px",
  maxW: "420px",
  color: "fg.subtle",
});

const searchInputClass = css({
  w: "full",
  h: "8",
  pl: "8",
  pr: "8",
  borderRadius: "l2",
  bg: "bg.muted",
  fontSize: "sm",
  color: "fg.default",
  outline: "none",
  transitionProperty: "background-color, box-shadow",
  transitionDuration: "fast",
  _placeholder: { color: "fg.subtle" },
  _focusVisible: { bg: "bg.default", boxShadow: "0 0 0 1px token(colors.gray.7)" },
  "&::-webkit-search-cancel-button": { display: "none" },
});

const iconButtonClass = css({
  position: "absolute",
  right: "1.5",
  display: "inline-flex",
  p: "1",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  _hover: { color: "fg.default", bg: "gray.a3" },
});

const segmentClass = css({
  display: "inline-flex",
  p: "0.5",
  borderRadius: "l2",
  bg: "bg.muted",
});

const segmentButtonClass = css({
  px: "2.5",
  h: "7",
  borderRadius: "l1",
  fontSize: "sm",
  color: "fg.muted",
  cursor: "pointer",
  transitionProperty: "background-color, color, box-shadow",
  transitionDuration: "fast",
  _hover: { color: "fg.default" },
  "&[aria-pressed=true]": {
    bg: "bg.default",
    color: "fg.default",
    fontWeight: "medium",
    boxShadow: "xs",
  },
  _focusVisible: { outline: "2px solid", outlineColor: "gray.8" },
});

const countClass = css({
  ml: "auto",
  fontSize: "sm",
  color: "fg.subtle",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
});

const SORTS: { value: PathNoteSort; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "title", label: "A–Z" },
];

export const PathNoteToolbar = (props: {
  query: string;
  onQueryChange: (value: string) => void;
  sort: PathNoteSort;
  onSortChange: (value: PathNoteSort) => void;
  grouped: boolean;
  onGroupedChange: (value: boolean) => void;
  canGroup: boolean;
  shown: number;
  total: number;
  inputRef: (el: HTMLInputElement) => void;
}) => (
  <div class={toolbarClass}>
    <label class={searchWrapClass}>
      <SearchIcon size={14} class={css({ position: "absolute", left: "2.5" })} />
      <input
        ref={props.inputRef}
        class={searchInputClass}
        type="search"
        value={props.query}
        onInput={(event) => props.onQueryChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            if (props.query) props.onQueryChange("");
            else event.currentTarget.blur();
          }
        }}
        placeholder={`Filter ${props.total} notes`}
        aria-label="Filter notes in this path"
      />
      <Show when={props.query}>
        <button
          type="button"
          class={iconButtonClass}
          aria-label="Clear filter"
          onClick={() => props.onQueryChange("")}
        >
          <XIcon size={12} />
        </button>
      </Show>
    </label>
    <div class={segmentClass} role="group" aria-label="Sort notes">
      <For each={SORTS}>
        {(item) => (
          <button
            type="button"
            class={segmentButtonClass}
            aria-pressed={props.sort === item.value}
            onClick={() => props.onSortChange(item.value)}
          >
            {item.label}
          </button>
        )}
      </For>
    </div>
    <Show when={props.canGroup}>
      <div class={segmentClass} role="group" aria-label="Layout">
        <button
          type="button"
          class={segmentButtonClass}
          aria-pressed={!props.grouped}
          onClick={() => props.onGroupedChange(false)}
        >
          Flat
        </button>
        <button
          type="button"
          class={segmentButtonClass}
          aria-pressed={props.grouped}
          onClick={() => props.onGroupedChange(true)}
        >
          By subpath
        </button>
      </div>
    </Show>
    <span class={countClass}>
      {props.shown === props.total ? `${props.total}` : `${props.shown} of ${props.total}`}{" "}
      {props.total === 1 ? "note" : "notes"}
    </span>
  </div>
);
