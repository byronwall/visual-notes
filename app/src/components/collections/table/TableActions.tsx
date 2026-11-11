import { PlusIcon } from "lucide-solid";
import { Show } from "solid-js";
import { css } from "styled-system/css";
import type { CollectionView } from "~/lib/collections/types";
import { EmptyRows } from "./EmptyRows";

const actionRow = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  h: "9",
  px: "2",
  color: "fg.subtle",
  cursor: "pointer",
  w: "full",
  textAlign: "left",
  borderBottomWidth: "1px",
  borderColor: "border",
  _hover: { bg: "bg.subtle", color: "fg.default" },
});

/** Full-width strip under the rows: show-all, the empty state, and New. */
export const TableActions = (props: {
  view: CollectionView;
  /** Rows the view matches, and how many of them are rendered. */
  total: number;
  shown: number;
  /** True when the view hides every row of a non-empty collection. */
  empty: boolean;
  onShowAll: () => void;
  onAdd: () => void;
}) => (
  <div style={{ "grid-column": "1 / -1" }}>
    <Show when={props.shown < props.total}>
      <button type="button" class={actionRow} onClick={() => props.onShowAll()}>
        Show all {props.total} rows
      </button>
    </Show>
    <Show when={props.empty}>
      <EmptyRows view={props.view} />
    </Show>
    <button type="button" class={actionRow} onClick={() => props.onAdd()}>
      <PlusIcon size={14} />
      New
    </button>
  </div>
);
