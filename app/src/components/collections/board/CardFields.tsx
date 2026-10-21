import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import type {
  CollectionProperty,
  CollectionRow,
} from "~/lib/collections/types";
import { isEmptyValue, readValue } from "~/lib/collections/values";
import { ValueDisplay } from "../values/ValueDisplay";

const list = css({
  display: "flex",
  flexDirection: "column",
  gap: "1",
  fontSize: "xs",
  color: "fg.muted",
  minW: "0",
});
const line = css({
  display: "flex",
  alignItems: "center",
  minW: "0",
  minH: "5",
});

/** The chosen properties on a board or gallery card; empty values are skipped. */
export const CardFields = (props: {
  row: CollectionRow;
  properties: CollectionProperty[];
}) => (
  <Show
    when={props.properties.some(
      (p) => !isEmptyValue(readValue(props.row, p)) || p.kind === "checkbox",
    )}
  >
    <div class={list}>
      <For each={props.properties}>
        {(property) => (
          <Show
            when={
              !isEmptyValue(readValue(props.row, property)) ||
              property.kind === "checkbox"
            }
          >
            <div class={line} title={property.name}>
              <ValueDisplay
                property={property}
                value={readValue(props.row, property)}
                wrap
              />
            </div>
          </Show>
        )}
      </For>
    </div>
  </Show>
);
