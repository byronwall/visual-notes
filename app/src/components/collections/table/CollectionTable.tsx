import { PlusIcon } from "lucide-solid";
import { For, Show, createMemo, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { applyView, orderedProperties, TITLE_PROPERTY } from "~/lib/collections/query";
import type { CollectionProperty, CollectionView } from "~/lib/collections/types";
import { TITLE_PROPERTY_ID } from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";
import { AddPropertyMenu } from "../menu/AddPropertyMenu";
import { PropertyMenu } from "../menu/PropertyMenu";
import { PropertyKindIcon } from "../PropertyKindIcon";
import { ValueCell } from "../values/ValueCell";
import { TitleCell } from "./TitleCell";

const DEFAULT_WIDTH = 180;
const TITLE_WIDTH = 280;
const ADD_COLUMN = 44;

const scroller = css({
  overflowX: "auto",
  overflowY: "visible",
  borderTopWidth: "1px",
  borderColor: "border",
});
const grid = css({ display: "grid", minW: "max-content", fontSize: "sm" });
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
const headerCell = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  h: "9",
  px: "2",
  color: "fg.muted",
  fontSize: "xs",
  fontWeight: "medium",
  cursor: "pointer",
  minW: "0",
  borderRightWidth: "1px",
  borderColor: "border",
  w: "full",
  textAlign: "left",
  _hover: { bg: "bg.muted" },
});
const headerLabel = css({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
const row = css({
  display: "contents",
  "& > *": { borderBottomWidth: "1px", borderColor: "border", minW: "0" },
  "&:hover > *": { bg: "bg.subtle" },
});
const bodyCell = css({
  borderRightWidth: "1px",
  borderColor: "border",
  display: "flex",
  alignItems: "stretch",
  minW: "0",
  "&:focus-within": { boxShadow: "inset 0 0 0 2px token(colors.border.accent)" },
});
const newRow = css({
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
const empty = css({ px: "3", py: "8", color: "fg.muted", fontSize: "sm", textAlign: "center" });

/** Spreadsheet-style view: one row per note, one column per property. */
export const CollectionTable = (props: { view: CollectionView }) => {
  const { store } = useCollection();
  const [autoEditRowId, setAutoEditRowId] = createSignal<string | null>(null);

  const columns = createMemo<CollectionProperty[]>(() => [
    TITLE_PROPERTY,
    ...orderedProperties(store.state.properties, props.view.config),
  ]);
  const rows = createMemo(() =>
    applyView(store.state.rows, store.state.properties, props.view.config, store.state.today),
  );
  const widthOf = (id: string) =>
    props.view.config.columnWidths?.[id] ?? (id === TITLE_PROPERTY_ID ? TITLE_WIDTH : DEFAULT_WIDTH);
  const template = () => `${columns().map((c) => `${widthOf(c.id)}px`).join(" ")} ${ADD_COLUMN}px`;

  const addRow = async () => {
    const created = await store.addRow();
    if (created) setAutoEditRowId(created.id);
  };

  return (
    <div class={scroller}>
      <div class={grid} style={{ "grid-template-columns": template() }} role="grid" aria-rowcount={rows().length + 1}>
        <div class={headerRow} role="row">
          <For each={columns()}>
            {(property) => (
              <div role="columnheader" style={{ display: "flex" }}>
                <PropertyMenu
                  property={property}
                  viewId={props.view.id}
                  anchor={(open) => (
                    <button type="button" class={headerCell} onClick={open} aria-label={`${property.name} column menu`}>
                      <PropertyKindIcon property={property} size={13} />
                      <span class={headerLabel}>{property.name}</span>
                    </button>
                  )}
                />
              </div>
            )}
          </For>
          <div role="columnheader">
            <AddPropertyMenu />
          </div>
        </div>

        <For each={rows()}>
          {(r) => (
            <div class={row} role="row" data-row-id={r.id}>
              <For each={columns()}>
                {(property) => (
                  <div class={bodyCell} role="gridcell">
                    <Show
                      when={property.id !== TITLE_PROPERTY_ID}
                      fallback={
                        <TitleCell
                          row={r}
                          autoEdit={autoEditRowId() === r.id}
                          onEditEnd={() => autoEditRowId() === r.id && setAutoEditRowId(null)}
                        />
                      }
                    >
                      <ValueCell property={property} row={r} store={store} />
                    </Show>
                  </div>
                )}
              </For>
              <div />
            </div>
          )}
        </For>

        <div style={{ "grid-column": "1 / -1" }}>
          <Show when={rows().length === 0 && store.state.rows.length > 0}>
            <div class={empty}>No rows match this view.</div>
          </Show>
          <button type="button" class={newRow} onClick={() => void addRow()}>
            <PlusIcon size={14} />
            New
          </button>
        </div>
      </div>
    </div>
  );
};
