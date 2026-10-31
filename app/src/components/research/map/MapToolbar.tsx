import {
  MaximizeIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-solid";
import { Show } from "solid-js";
import { css } from "styled-system/css";
import { Kbd } from "~/components/ui/kbd";
import { searchClass } from "../inspector/TopicInspector";

export const barButtonClass = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minW: "7",
  h: "7",
  px: "1.5",
  fontSize: "sm",
  color: "fg.muted",
  borderRadius: "l1",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "bg.hover", color: "fg.default" },
  _active: { bg: "gray.a5" },
  _focusVisible: {
    outline: "2px solid token(colors.border.focus)",
    outlineOffset: "1px",
  },
  "@media (pointer: coarse)": { h: "9", minW: "9" },
});

/** The topic search. The map and the rail share one query. */
export const MapSearch = (props: {
  query: string;
  /** Cards found, or null without a search. */
  found: number | null;
  /** 1-based place of the open card among the matches, or 0. */
  matchAt: number;
  onQuery: (query: string) => void;
  /** Enter steps forward through the matches, Shift+Enter back. */
  onStep: (step: 1 | -1) => void;
}) => (
  <label
    class={`${searchClass} ${css({ flex: "1 1 20rem", minW: "11rem", maxW: "20rem" })}`}
  >
    <SearchIcon size={14} />
    <input
      type="search"
      data-map-search
      placeholder="Search cards"
      aria-label="Search cards"
      value={props.query}
      onInput={(event) => props.onQuery(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.isComposing) {
          event.preventDefault();
          props.onStep(event.shiftKey ? -1 : 1);
          return;
        }
        if (event.key !== "Escape") return;
        props.onQuery("");
        event.currentTarget.blur();
      }}
    />
    <Show when={props.found !== null}>
      <span
        class={css({
          flex: "none",
          fontSize: "xs",
          color: "fg.muted",
          fontVariantNumeric: "tabular-nums",
        })}
      >
        {props.matchAt
          ? `${props.matchAt} of ${props.found}`
          : props.found
            ? `${props.found} found`
            : "None found"}
      </span>
    </Show>
    <Show
      when={props.query}
      fallback={
        <Kbd size="sm" aria-hidden="true" class={css({ color: "fg.subtle" })}>
          /
        </Kbd>
      }
    >
      <button
        type="button"
        aria-label="Clear search"
        class={css({
          display: "inline-flex",
          cursor: "pointer",
          color: "fg.muted",
          _hover: { color: "fg.default" },
        })}
        onClick={() => props.onQuery("")}
      >
        <XIcon size={14} />
      </button>
    </Show>
  </label>
);

export const MapToolbar = (props: {
  query: string;
  found: number | null;
  matchAt: number;
  onQuery: (query: string) => void;
  onStep: (step: 1 | -1) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFit: () => void;
}) => (
  <div
    role="toolbar"
    aria-label="Map"
    class={css({
      flex: "none",
      display: "flex",
      alignItems: "center",
      gap: "1",
      px: "3",
      py: "1.5",
    })}
  >
    <MapSearch
      query={props.query}
      found={props.found}
      matchAt={props.matchAt}
      onQuery={props.onQuery}
      onStep={props.onStep}
    />
    <span class={css({ flex: 1 })} />
    <button
      type="button"
      class={barButtonClass}
      onClick={() => props.onExpandAll()}
    >
      Expand all
    </button>
    <button
      type="button"
      class={barButtonClass}
      onClick={() => props.onCollapseAll()}
    >
      Collapse all
    </button>
    <button
      type="button"
      class={barButtonClass}
      aria-label="Zoom out"
      title="Zoom out"
      onClick={() => props.onZoomOut()}
    >
      <MinusIcon size={14} />
    </button>
    <button
      type="button"
      class={barButtonClass}
      aria-label="Zoom in"
      title="Zoom in"
      onClick={() => props.onZoomIn()}
    >
      <PlusIcon size={14} />
    </button>
    <button
      type="button"
      class={barButtonClass}
      title="Fit the map to the view"
      onClick={() => props.onFit()}
    >
      <MaximizeIcon size={14} />
      <span class={css({ ml: "1" })}>Fit</span>
    </button>
  </div>
);
