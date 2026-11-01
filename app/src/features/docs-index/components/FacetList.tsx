import { For, Show, createMemo, createSignal } from "solid-js";
import { XIcon } from "lucide-solid";
import { css } from "styled-system/css";

export type FacetItem = {
  key: string;
  label: string;
  count?: number;
  selected: boolean;
  mono?: boolean;
  onSelect: () => void;
};

const rowClass = css({
  display: "flex",
  alignItems: "baseline",
  gap: "2",
  w: "full",
  py: "1",
  px: "2",
  mx: "-2",
  boxSizing: "content-box",
  borderRadius: "l2",
  fontSize: "sm",
  lineHeight: "1.25rem",
  color: "fg.default",
  textAlign: "left",
  cursor: "pointer",
  transitionProperty: "background-color",
  transitionDuration: "120ms",
  _hover: { bg: "bg.hover" },
  _active: { bg: "gray.subtle.bg.active" },
  "&[aria-pressed=true]": { bg: "bg.selected", fontWeight: "medium" },
  "&[aria-pressed=true]:hover": { bg: "bg.selectedHover" },
  "&[data-empty]:not([aria-pressed=true])": { color: "fg.subtle" },
  // Lists are for reading, so a long name wraps instead of hiding its end.
  "& .label": { flex: "1", minW: "0", overflowWrap: "anywhere" },
  "& .label[data-mono]": { fontFamily: "mono", fontSize: "xs" },
  "& .end": {
    position: "relative",
    flexShrink: "0",
    textAlign: "right",
    color: "fg.subtle",
    fontSize: "xs",
    fontWeight: "normal",
    fontVariantNumeric: "tabular-nums",
  },
  // Selected rows keep their count; hover shows that a click clears them.
  "& .clear": {
    display: "none",
    position: "absolute",
    right: "0",
    top: "50%",
    transform: "translateY(-50%)",
    color: "fg.default",
  },
  "&[aria-pressed=true]:hover .clear": { display: "block" },
  "&[aria-pressed=true]:hover .count": { visibility: "hidden" },
  "&[aria-pressed=true] .end": { minW: "3.5" },
  smDown: { py: "2" },
});

const moreClass = css({
  h: "7",
  alignSelf: "flex-start",
  fontSize: "xs",
  color: "fg.muted",
  cursor: "pointer",
  _hover: { color: "fg.default" },
  smDown: { h: "9" },
});

/** One-click filter values with live counts; a second click clears the value. */
export const FacetList = (props: {
  items: FacetItem[];
  /** Rows shown before "Show more". */
  limit?: number;
}) => {
  const [expanded, setExpanded] = createSignal(false);
  const limit = () => props.limit ?? 6;
  // A selected value stays visible even when it ranks below the fold.
  const visible = createMemo(() =>
    // Hiding a single row saves nothing over the "Show more" line it needs.
    expanded() || props.items.length <= limit() + 1
      ? props.items
      : props.items.filter((item, i) => i < limit() || item.selected),
  );
  const hiddenCount = () => props.items.length - visible().length;

  return (
    <>
      <For each={visible()}>
        {(item) => (
          <button
            type="button"
            class={rowClass}
            aria-pressed={item.selected}
            data-empty={item.count === 0 ? "" : undefined}
            onClick={item.onSelect}
          >
            <span class="label" data-mono={item.mono ? "" : undefined}>
              {item.label}
            </span>
            <span class="end">
              <Show when={item.count !== undefined}>
                <span class="count">{item.count!.toLocaleString()}</span>
              </Show>
              <span class="clear">
                <XIcon size={13} aria-hidden="true" />
              </span>
            </span>
          </button>
        )}
      </For>
      <Show
        when={
          hiddenCount() > 0 || (expanded() && props.items.length > limit() + 1)
        }
      >
        <button
          type="button"
          class={moreClass}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded() ? "Show less" : `Show ${hiddenCount()} more`}
        </button>
      </Show>
    </>
  );
};
