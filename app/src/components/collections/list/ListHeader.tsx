import { Show } from "solid-js";
import { css } from "styled-system/css";
import { BulkBar } from "../table/BulkBar";
import type { useRowSelection } from "../table/useRowSelection";

const header = css({
  position: "relative",
  zIndex: "3",
  display: "flex",
  alignItems: "center",
  gap: "2",
  h: "10",
  py: "1",
  bg: "bg.default",
  fontSize: "sm",
  // Below md the app bar (h 12) is fixed over the page, so stick under it.
  "&[data-sticky]": { position: "sticky", top: { base: "12", md: "0" } },
});
const count = css({
  flex: "1",
  minW: "0",
  color: "fg.muted",
  fontVariantNumeric: "tabular-nums",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
const btn = css({
  flexShrink: "0",
  h: "8",
  px: "3",
  borderRadius: "l2",
  color: "fg.default",
  fontSize: "sm",
  fontWeight: "medium",
  cursor: "pointer",
  transition: "background-color 140ms",
  _hover: { bg: "bg.muted" },
  _active: { bg: "bg.emphasized" },
  "&[data-primary]": { bg: "bg.muted" },
});
// BulkBar sits just above its containing block (it normally covers the
// toolbar). This zero-height anchor, 8px below the header's 32px content,
// puts it exactly over the header, so it sticks while the list scrolls.
const bulkAnchor = css({
  position: "absolute",
  left: "0",
  right: "0",
  top: "calc(var(--spacing-1) + var(--spacing-8) + var(--spacing-2))",
  h: "0",
});

/** Row count and Select; while selecting, the bulk actions and Done. */
export const ListHeader = (props: {
  total: number;
  matched: number;
  sticky: boolean;
  selecting: boolean;
  selection: ReturnType<typeof useRowSelection>;
  onSelect: () => void;
  onDone: () => void;
}) => (
  <div class={header} data-sticky={props.sticky ? "" : undefined}>
    <Show
      when={props.selecting}
      fallback={
        <>
          <span class={count} data-list-count>
            {props.matched === props.total
              ? `${props.total} ${props.total === 1 ? "row" : "rows"}`
              : `${props.matched} shown · ${props.total} total`}
          </span>
          <Show when={props.matched > 0}>
            <button type="button" class={btn} onClick={() => props.onSelect()}>
              Select
            </button>
          </Show>
        </>
      }
    >
      <span class={count}>Tap rows to select</span>
      <button
        type="button"
        class={btn}
        onClick={() => props.selection.toggleAll()}
      >
        Select all
      </button>
      <button
        type="button"
        class={btn}
        data-primary
        onClick={() => props.onDone()}
      >
        Done
      </button>
      <Show when={props.selection.count() > 0}>
        <div class={bulkAnchor}>
          <BulkBar
            selected={props.selection.selectedIds()}
            onClear={() => props.onDone()}
          />
        </div>
      </Show>
    </Show>
  </div>
);
