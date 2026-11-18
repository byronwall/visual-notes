import { splitProps, type JSX, type ValidComponent } from "solid-js";
import { Dynamic } from "solid-js/web";
import { css, cx } from "styled-system/css";

/**
 * Aligned lists. The list owns the one column template; every row and group
 * is a subgrid of it. A column sized `auto` or `max-content` therefore takes
 * the widest cell in the whole list, never the widest cell in one row, so
 * columns cannot drift from row to row.
 *
 * The list pulls out by the `bleed` token and rows pad back in by it, so row
 * text sits on the page's content edge, in line with the toolbar above.
 *
 *   const cols = css({ gridTemplateColumns: "8rem minmax(0, 1fr) auto" });
 *   <RowList class={cols}>
 *     <For each={items()}>{(item) => <RowListRow>…</RowListRow>}</For>
 *   </RowList>
 *
 * Rows place cells with `gridColumn` only; they never set their own columns
 * (lint: `vn/row-columns`).
 */

const list = css({
  display: "grid",
  columnGap: "3",
  alignContent: "start",
  mx: "-bleed",
  minW: "0",
});

// Panda extracts styles statically, so each class spells out its subgrid.
const row = css({
  gridColumn: "1 / -1",
  display: "grid",
  gridTemplateColumns: "subgrid",
  minW: "0",
  alignItems: "center",
  px: "bleed",
  borderRadius: "l2",
});

const group = css({
  gridColumn: "1 / -1",
  display: "grid",
  gridTemplateColumns: "subgrid",
  minW: "0",
});

const span = css({ gridColumn: "1 / -1", px: "bleed", minW: "0" });

type Props = JSX.HTMLAttributes<HTMLElement> & {
  as?: ValidComponent;
  class?: string;
  [key: string]: unknown;
};

const make = (base: string, tag: ValidComponent) => (props: Props) => {
  const [local, rest] = splitProps(props, ["as", "class"]);
  return (
    <Dynamic
      component={local.as ?? tag}
      class={cx(base, local.class)}
      {...rest}
    />
  );
};

/** The grid for a whole list. Put `gridTemplateColumns` in `class`. */
export const RowList = make(list, "div");
/** One row: a subgrid that spans every column of its list. */
export const RowListRow = make(row, "div");
/** A run of rows (a day, a section): a subgrid with no padding of its own. */
export const RowListGroup = make(group, "section");
/** A full-width cell: a heading, a note, an empty state. */
export const RowListSpan = make(span, "div");

/** Class names for elements that cannot be swapped for the components. */
export const rowListClass = { list, row, group, span };
