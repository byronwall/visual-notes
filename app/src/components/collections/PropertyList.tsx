import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import type { CollectionRow } from "~/lib/collections/types";
import { useCollection } from "./CollectionContext";
import { AddPropertyMenu } from "./menu/AddPropertyMenu";
import { PropertyKindIcon } from "./PropertyKindIcon";
import { ValueCell } from "./values/ValueCell";

const list = css({
  display: "flex",
  flexDirection: "column",
  gap: "0.5",
  mb: "4",
});
const line = css({
  display: "grid",
  gridTemplateColumns: "minmax(7rem, 11rem) 1fr",
  alignItems: "center",
  gap: "2",
});
const label = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  minW: "0",
  h: "8",
  px: "1",
  color: "fg.muted",
  fontSize: "sm",
  "& span": {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
const addBtn = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  h: "8",
  px: "1",
  color: "fg.subtle",
  fontSize: "sm",
  cursor: "pointer",
  borderRadius: "l2",
  _hover: { color: "fg.default", bg: "bg.muted" },
});

/** A row's properties as label/value lines, shown above its note body. */
export const PropertyList = (props: {
  row: CollectionRow;
  allowAdd?: boolean;
}) => {
  const { store } = useCollection();
  return (
    <div class={list} aria-label="Properties">
      <For each={store.state.properties}>
        {(property) => (
          <div class={line}>
            <div class={label}>
              <PropertyKindIcon property={property} />
              <span>{property.name}</span>
            </div>
            <ValueCell
              property={property}
              row={props.row}
              store={store}
              variant="field"
              wrap
            />
          </div>
        )}
      </For>
      <Show when={props.allowAdd !== false}>
        <div>
          <AddPropertyMenu
            class={addBtn}
            label="Add a property"
            placement="bottom-start"
            anchorClass={css({ display: "inline-flex" })}
          />
        </div>
      </Show>
    </div>
  );
};
