import { For, Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import type { CollectionRow } from "~/lib/collections/types";
import { useCollection } from "./CollectionContext";
import { AddPropertyMenu } from "./menu/AddPropertyMenu";
import { PropertyMenu } from "./menu/PropertyMenu";
import { PropertyKindIcon } from "./PropertyKindIcon";
import { ValueCell } from "./values/ValueCell";

const list = css({
  display: "flex",
  flexDirection: "column",
  gap: "1",
  mb: "4",
  // The list sits in note columns and the narrow peek panel alike, so it
  // adapts to its own width rather than the viewport.
  containerType: "inline-size",
});
const line = css({
  display: "grid",
  gridTemplateColumns: "minmax(7rem, 10rem) minmax(0, 1fr)",
  alignItems: "center",
  gap: "2",
  "@container (max-width: 30rem)": {
    gridTemplateColumns: "minmax(0, 7.5rem) minmax(0, 1fr)",
    gap: "1",
  },
});
const label = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  minW: "0",
  h: "8",
  px: "1",
  w: "full",
  color: "fg.muted",
  fontSize: "sm",
  textAlign: "left",
  borderRadius: "l2",
  cursor: "pointer",
  transitionProperty: "color, background-color",
  transitionDuration: "140ms",
  _hover: { color: "fg.default", bg: "gray.a2" },
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
  // A property added here opens its editor right away.
  const [justAdded, setJustAdded] = createSignal<string>();
  return (
    <div class={list} aria-label="Properties">
      <For each={store.state.properties}>
        {(property) => (
          <div class={line} data-property-line="">
            <PropertyMenu
              property={property}
              anchor={(open) => (
                <button
                  type="button"
                  class={label}
                  aria-label={`${property.name} property settings`}
                  onClick={open}
                >
                  <PropertyKindIcon property={property} />
                  <span>{property.name}</span>
                </button>
              )}
            />
            <ValueCell
              autoEdit={justAdded() === property.id}
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
            onAdded={(property) => setJustAdded(property.id)}
          />
        </div>
      </Show>
    </div>
  );
};
