import { For } from "solid-js";
import { css } from "styled-system/css";
import { TITLE_PROPERTY_ID } from "~/lib/collections/types";
import { AddPropertyMenu } from "../menu/AddPropertyMenu";
import {
  selectBox,
  selectCell,
  selectHit,
  stickySelect,
  stickyTitle,
  stickyTitleStyle,
} from "./table-styles";
import { TableHeaderCell } from "./TableHeaderCell";
import type { useColumns } from "./useColumns";
import type { useRowSelection } from "./useRowSelection";

const headerRow = css({
  display: "contents",
  "& > *": {
    position: "sticky",
    top: "0",
    zIndex: "2",
    bg: "bg.default",
    borderBottomWidth: "1px",
    borderColor: "border",
  },
});

/** Sticky column headers with select-all and the add-property menu. */
export const TableHeaderRow = (props: {
  viewId: string;
  cols: ReturnType<typeof useColumns>;
  selection: ReturnType<typeof useRowSelection>;
}) => (
  <div class={headerRow} role="row" data-table-head="">
    <div class={`${selectCell} ${stickySelect}`} style={{ "z-index": 3 }}>
      <label class={selectHit}>
        <input
          type="checkbox"
          class={selectBox}
          style={{ opacity: props.selection.count() ? 1 : 0.35 }}
          aria-label="Select all rows"
          checked={props.selection.allSelected()}
          onChange={() => props.selection.toggleAll()}
        />
      </label>
    </div>
    <For each={props.cols.columns()}>
      {(property) => (
        <div
          class={property.id === TITLE_PROPERTY_ID ? stickyTitle : undefined}
          style={
            property.id === TITLE_PROPERTY_ID
              ? { ...stickyTitleStyle, "z-index": 3 }
              : undefined
          }
        >
          <TableHeaderCell
            property={property}
            viewId={props.viewId}
            width={props.cols.widthOf(property.id)}
            dropSide={props.cols.dropSideOf(property.id)}
            onResize={(w, done) => props.cols.resize(property.id, w, done)}
            onDragStart={props.cols.startDrag}
            onDragOver={props.cols.dragOver}
            onDrop={props.cols.finishDrag}
            onDragEnd={props.cols.endDrag}
          />
        </div>
      )}
    </For>
    <div role="columnheader">
      <AddPropertyMenu />
    </div>
  </div>
);
