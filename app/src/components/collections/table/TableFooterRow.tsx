import { For } from "solid-js";
import { css } from "styled-system/css";
import type {
  Aggregation,
  CollectionProperty,
  CollectionRow,
  CollectionView,
} from "~/lib/collections/types";
import { TITLE_PROPERTY_ID } from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";
import { FooterCell } from "./FooterCell";
import { stickySelect, stickyTitle, stickyTitleStyle } from "./table-styles";

const footerRow = css({
  display: "contents",
  "& > *": {
    position: "sticky",
    bottom: "0",
    zIndex: "2",
    borderBottomWidth: "1px",
    borderColor: "border",
    bg: "bg.default",
    minW: "0",
  },
});

/** Sticky per-column summaries (count, sum, and so on). */
export const TableFooterRow = (props: {
  view: CollectionView;
  columns: CollectionProperty[];
  rows: CollectionRow[];
}) => {
  const { store } = useCollection();
  const aggregationOf = (id: string): Aggregation =>
    props.view.config.aggregations?.[id] ??
    (id === TITLE_PROPERTY_ID ? "count" : "none");
  return (
    <div class={footerRow} role="row" data-table-foot="">
      <div class={stickySelect} />
      <For each={props.columns}>
        {(property) => (
          <div
            class={property.id === TITLE_PROPERTY_ID ? stickyTitle : undefined}
            style={
              property.id === TITLE_PROPERTY_ID ? stickyTitleStyle : undefined
            }
          >
            <FooterCell
              property={property}
              rows={props.rows}
              aggregation={aggregationOf(property.id)}
              onChange={(aggregation) =>
                store.patchViewConfig(props.view.id, {
                  aggregations: {
                    ...(props.view.config.aggregations ?? {}),
                    [property.id]: aggregation,
                  },
                })
              }
            />
          </div>
        )}
      </For>
      <div />
    </div>
  );
};
