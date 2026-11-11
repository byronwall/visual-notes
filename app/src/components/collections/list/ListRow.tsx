import { CheckIcon } from "lucide-solid";
import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import type {
  CollectionProperty,
  CollectionRow,
} from "~/lib/collections/types";
import { readValue } from "~/lib/collections/values";
import { ValueDisplay } from "../values/ValueDisplay";

// Heights here must match listRowHeight: 10px padding, 20px lines.
const row = css({
  position: "relative",
  display: "flex",
  alignItems: "flex-start",
  gap: "3",
  px: "3",
  py: "10px",
  borderBottomWidth: "1px",
  borderColor: "border",
  bg: "bg.default",
  overflow: "hidden",
  WebkitTapHighlightColor: "transparent",
  transition: "background-color 120ms",
  "@media (hover: hover)": { _hover: { bg: "bg.subtle" } },
  "&:active": { bg: "bg.muted" },
  "&[data-selected]": { bg: "bg.selected" },
});
const body = css({
  flex: "1",
  minW: "0",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
});
// The name is the tap target; its ::after covers the whole record, so a tap
// anywhere opens it. Links inside sit above that layer.
const title = css({
  display: "block",
  w: "full",
  textAlign: "left",
  fontSize: "sm",
  fontWeight: "medium",
  lineHeight: "20px",
  color: "fg.default",
  cursor: "pointer",
  _after: { content: '""', position: "absolute", inset: "0" },
  _focusVisible: { outline: "none" },
  "&:focus-visible::after": {
    boxShadow: "inset 0 0 0 2px token(colors.border.accent)",
  },
});
const titleText = css({ lineClamp: "2", overflowWrap: "anywhere" });
const untitled = css({ color: "fg.subtle" });
const fieldList = css({
  display: "flex",
  flexDirection: "column",
  minW: "0",
  m: "0",
});
const field = css({
  display: "grid",
  gridTemplateColumns: "min(7rem, 34%) minmax(0, 1fr)",
  alignItems: "center",
  gap: "2",
  h: "20px",
  fontSize: "xs",
  minW: "0",
});
const label = css({
  color: "fg.subtle",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
const value = css({
  display: "flex",
  alignItems: "center",
  minW: "0",
  m: "0",
  color: "fg.default",
  overflow: "hidden",
  "& a": { position: "relative", zIndex: "1" },
});
const check = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: "0",
  boxSize: "5",
  mt: "2px",
  borderRadius: "l1",
  borderWidth: "1.5px",
  borderColor: "border.emphasized",
  color: "bg.default",
  "&[data-checked]": { bg: "fg.default", borderColor: "fg.default" },
});

/**
 * One record in the narrow list: its name on up to two lines, then a few
 * labelled values. Read-only; a tap opens the record, or toggles it while
 * selecting.
 */
export const ListRow = (props: {
  row: CollectionRow;
  fields: CollectionProperty[];
  height: number;
  selecting: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) => {
  const name = () => props.row.title.trim();
  return (
    <div
      class={row}
      role="listitem"
      style={{ height: `${props.height}px` }}
      data-row-id={props.row.id}
      data-selected={props.selected ? "" : undefined}
    >
      <Show when={props.selecting}>
        <span
          class={check}
          data-checked={props.selected ? "" : undefined}
          aria-hidden="true"
        >
          <Show when={props.selected}>
            <CheckIcon size={13} stroke-width={3} />
          </Show>
        </span>
      </Show>
      <div class={body}>
        <button
          type="button"
          class={title}
          data-property-id="title"
          role={props.selecting ? "checkbox" : undefined}
          aria-checked={props.selecting ? props.selected : undefined}
          onClick={() => (props.selecting ? props.onToggle() : props.onOpen())}
        >
          <span class={`${titleText} ${name() ? "" : untitled}`}>
            {name() || "Untitled"}
          </span>
        </button>
        <Show when={props.fields.length}>
          <dl class={fieldList}>
            <For each={props.fields}>
              {(property) => (
                <div class={field}>
                  <dt class={label}>{property.name}</dt>
                  <dd class={value}>
                    <ValueDisplay
                      property={property}
                      value={readValue(props.row, property)}
                      placeholder="—"
                      linkOpens="button"
                    />
                  </dd>
                </div>
              )}
            </For>
          </dl>
        </Show>
      </div>
    </div>
  );
};
