import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import type {
  CollectionProperty,
  CollectionRow,
} from "~/lib/collections/types";
import { isEmptyValue, readValue } from "~/lib/collections/values";
import { ValueDisplay } from "../values/ValueDisplay";

// Two columns so values line up under each other across a card.
const list = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, max-content) minmax(0, 1fr)",
  columnGap: "2",
  rowGap: "0.5",
  fontSize: "xs",
  color: "fg.muted",
  minW: "0",
});
const label = css({
  color: "fg.subtle",
  maxW: "7rem",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  alignSelf: "center",
});
const value = css({
  display: "flex",
  alignItems: "center",
  minW: "0",
  minH: "5",
  "&[data-full]": { gridColumn: "1 / -1" },
});

/** Chips name their own value, so they read clearly without a label. */
const selfDescribing = (p: CollectionProperty) =>
  p.kind === "status" || p.kind === "select";

/**
 * The chosen properties on a board or gallery card, each with a muted label.
 * With `showEmpty` (the view picked its card fields), empty values show "—"
 * so missing data stays visible; otherwise empty values are skipped.
 */
export const CardFields = (props: {
  row: CollectionRow;
  properties: CollectionProperty[];
  showEmpty?: boolean;
}) => {
  const empty = (p: CollectionProperty) =>
    isEmptyValue(readValue(props.row, p)) && p.kind !== "checkbox";
  const shown = () =>
    props.showEmpty
      ? props.properties
      : props.properties.filter((p) => !empty(p));
  return (
    <Show when={shown().length > 0}>
      <div class={list}>
        <For each={shown()}>
          {(property) => {
            const labelled = () => !selfDescribing(property) || empty(property);
            return (
              <>
                <Show when={labelled()}>
                  <span class={label}>{property.name}</span>
                </Show>
                <div class={value} data-full={labelled() ? undefined : ""}>
                  <ValueDisplay
                    property={property}
                    value={readValue(props.row, property)}
                    placeholder="—"
                    wrap
                  />
                </div>
              </>
            );
          }}
        </For>
      </div>
    </Show>
  );
};
