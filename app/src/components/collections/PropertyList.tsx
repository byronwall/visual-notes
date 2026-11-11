import { Settings2Icon } from "lucide-solid";
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
// Labels sit at the top of their line, so they stay put beside long text.
const line = css({
  display: "grid",
  gridTemplateColumns: "10rem minmax(0, 1fr)",
  alignItems: "start",
  gap: "2",
  "@container (max-width: 30rem)": {
    gridTemplateColumns: "7.5rem minmax(0, 1fr)",
    gap: "1",
  },
});
const labelCell = css({
  display: "flex",
  alignItems: "center",
  gap: "0.5",
  minW: "0",
  h: "8",
});
// Plain text: a click edits the value next to it, like a form label.
const label = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  flex: "1",
  minW: "0",
  h: "full",
  px: "1",
  color: "fg.muted",
  fontSize: "sm",
  cursor: "default",
  userSelect: "none",
  "& span": {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
const settings = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: "0",
  boxSize: "6",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  opacity: "0",
  transitionProperty: "opacity, color, background-color",
  transitionDuration: "140ms",
  "[data-property-line]:hover &, [data-property-line]:focus-within &": {
    opacity: "1",
  },
  _focusVisible: {
    opacity: "1",
    outline: "2px solid token(colors.border.accent)",
  },
  "&[data-open]": { opacity: "1", color: "fg.default", bg: "bg.hover" },
  _hover: { color: "fg.default", bg: "bg.hover" },
  "@media (hover: none)": { opacity: "1" },
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

/** Starts editing a value as if it were clicked; stars take focus instead. */
const activate = (cell: HTMLElement | undefined) => {
  if (!cell) return;
  const star = cell.querySelector<HTMLElement>('[role="radio"][tabindex="0"]');
  if (star) return star.focus();
  cell.focus();
  cell.click();
};

/** A row's properties as label/value lines, shown above its note body. */
export const PropertyList = (props: {
  row: CollectionRow;
  /** Add, rename, retype, and delete properties. Off in embedded views. */
  allowSchemaEdits?: boolean;
}) => {
  const { store } = useCollection();
  // A property added here opens its editor right away.
  const [justAdded, setJustAdded] = createSignal<string>();
  return (
    <div class={list} aria-label="Properties">
      <For each={store.state.properties}>
        {(property) => {
          let cell: HTMLDivElement | undefined;
          return (
            <div class={line} data-property-line="">
              <div class={labelCell}>
                {/* Pointer shortcut only: the value itself is the control. */}
                <div class={label} onClick={() => activate(cell)}>
                  <PropertyKindIcon property={property} />
                  <span>{property.name}</span>
                </div>
                <Show when={props.allowSchemaEdits !== false}>
                  <PropertyMenu
                    property={property}
                    anchorClass={css({ display: "inline-flex" })}
                    anchor={(open) => (
                      <button
                        type="button"
                        class={settings}
                        aria-label={`${property.name} property settings`}
                        onClick={open}
                      >
                        <Settings2Icon size={14} />
                      </button>
                    )}
                  />
                </Show>
              </div>
              <ValueCell
                ref={(el) => (cell = el)}
                autoEdit={justAdded() === property.id}
                property={property}
                row={props.row}
                store={store}
                variant="field"
                wrap
              />
            </div>
          );
        }}
      </For>
      <Show when={props.allowSchemaEdits !== false}>
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
