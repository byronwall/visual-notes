import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import type {
  CollectionProperty,
  CollectionRow,
} from "~/lib/collections/types";
import { TITLE_PROPERTY_ID } from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";
import { ValueCell } from "../values/ValueCell";
import {
  selectBox,
  selectCell,
  selectHit,
  stickySelect,
  stickyTitle,
  stickyTitleStyle,
} from "./table-styles";
import { TitleCell } from "./TitleCell";
import type { EditEndReason } from "./useGridKeys";

const row = css({
  display: "contents",
  "& > *": {
    borderBottomWidth: "1px",
    borderColor: "border",
    minW: "0",
    bg: "bg.default",
    // Literal so Panda can extract it; must equal ROW_HEIGHT.
    height: "33px",
  },
  "&:hover > *": { bg: "bg.subtle" },
  "&[data-selected] > *, &[data-selected]:hover > *": { bg: "bg.selected" },
  "& [data-select-box]": { opacity: "0" },
  "&:hover [data-select-box], &:focus-within [data-select-box], &[data-selected] [data-select-box]":
    { opacity: "1" },
  // Touch screens have no hover, so the checkbox always shows there.
  "@media (hover: none)": { "& [data-select-box]": { opacity: "1" } },
});
const bodyCell = css({
  borderRightWidth: "1px",
  borderColor: "border",
  display: "flex",
  alignItems: "stretch",
  minW: "0",
  overflow: "hidden",
  "&:focus-within": {
    boxShadow: "inset 0 0 0 2px token(colors.border.accent)",
  },
});

/** One record in the table: a checkbox, its name, and a cell per property. */
export const TableRow = (props: {
  row: CollectionRow;
  index: number;
  columns: CollectionProperty[];
  selected: boolean;
  autoEdit: boolean;
  onToggle: (shift: boolean) => void;
  onAutoEditDone: () => void;
  onEditEnd: (colIndex: number) => (reason: EditEndReason) => void;
}) => {
  const { store } = useCollection();
  return (
    <div
      class={row}
      role="row"
      data-row-id={props.row.id}
      data-selected={props.selected ? "" : undefined}
    >
      <div class={`${selectCell} ${stickySelect}`}>
        <label class={selectHit}>
          <input
            type="checkbox"
            class={selectBox}
            data-select-box
            aria-label={`Select ${props.row.title}`}
            checked={props.selected}
            onClick={(e) => props.onToggle(e.shiftKey)}
          />
        </label>
      </div>
      <For each={props.columns}>
        {(property, colIndex) => (
          <div
            class={`${bodyCell} ${property.id === TITLE_PROPERTY_ID ? stickyTitle : ""}`}
            style={
              property.id === TITLE_PROPERTY_ID ? stickyTitleStyle : undefined
            }
            role="gridcell"
            data-row-index={props.index}
            data-col-index={colIndex()}
          >
            <Show
              when={property.id !== TITLE_PROPERTY_ID}
              fallback={
                <TitleCell
                  row={props.row}
                  autoEdit={props.autoEdit}
                  onEditEnd={(reason) => {
                    if (props.autoEdit) props.onAutoEditDone();
                    props.onEditEnd(colIndex())(reason);
                  }}
                />
              }
            >
              <ValueCell
                property={property}
                row={props.row}
                store={store}
                onEditEnd={(reason) => props.onEditEnd(colIndex())(reason)}
              />
            </Show>
          </div>
        )}
      </For>
      <div />
    </div>
  );
};
