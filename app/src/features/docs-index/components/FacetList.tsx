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
  alignItems: "center",
  gap: "2",
  w: "full",
  minH: "7",
  px: "2",
  mx: "-2",
  boxSizing: "content-box",
  borderRadius: "l2",
  fontSize: "sm",
  color: "fg.default",
  textAlign: "left",
  cursor: "pointer",
  transitionProperty: "background-color",
  transitionDuration: "120ms",
  _hover: { bg: "bg.hover" },
  "&[aria-pressed=true]": { bg: "bg.selected", fontWeight: "medium" },
  "&[aria-pressed=true]:hover": { bg: "bg.selectedHover" },
  "& .label": {
    flex: "1",
    minW: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  "& .label[data-mono]": { fontFamily: "mono", fontSize: "xs" },
  "& .count": {
    color: "fg.subtle",
    fontSize: "xs",
    fontWeight: "normal",
    fontVariantNumeric: "tabular-nums",
  },
  smDown: { minH: "9" },
});

const moreClass = css({
  h: "7",
  alignSelf: "flex-start",
  fontSize: "xs",
  color: "fg.muted",
  cursor: "pointer",
  _hover: { color: "fg.default" },
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
            title={item.label}
            onClick={item.onSelect}
          >
            <span class="label" data-mono={item.mono ? "" : undefined}>
              {item.label}
            </span>
            <Show
              when={item.selected}
              fallback={
                <Show when={item.count !== undefined}>
                  <span class="count">{item.count!.toLocaleString()}</span>
                </Show>
              }
            >
              <XIcon size={13} aria-hidden="true" />
            </Show>
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
