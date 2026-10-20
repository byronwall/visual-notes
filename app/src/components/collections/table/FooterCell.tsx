import { CheckIcon } from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { SimplePopover } from "~/components/ui/simple-popover";
import {
  AGGREGATION_LABELS,
  aggregate,
  aggregationsFor,
} from "~/lib/collections/aggregate";
import type {
  Aggregation,
  CollectionProperty,
  CollectionRow,
} from "~/lib/collections/types";
import { MenuItem, menuPanel } from "../menu/MenuList";
import { fitContent } from "../popover-styles";

const trigger = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "1",
  w: "full",
  h: "8",
  px: "2",
  fontSize: "xs",
  color: "fg.subtle",
  cursor: "pointer",
  whiteSpace: "nowrap",
  overflow: "hidden",
  "& [data-hint]": { opacity: "0" },
  _hover: { bg: "bg.muted", "& [data-hint]": { opacity: "1" } },
});
const value = css({
  color: "fg.default",
  fontWeight: "medium",
  fontVariantNumeric: "tabular-nums",
});

/** A column's footer summary; click to choose what it calculates. */
export const FooterCell = (props: {
  property: CollectionProperty;
  rows: CollectionRow[];
  aggregation: Aggregation;
  onChange: (aggregation: Aggregation) => void;
}) => {
  const [open, setOpen] = createSignal(false);
  const text = () => aggregate(props.rows, props.property, props.aggregation);
  return (
    <SimplePopover
      class={fitContent}
      open={open()}
      onClose={() => setOpen(false)}
      placement="top-end"
      anchorClass={css({ w: "full" })}
      anchor={
        <button
          type="button"
          class={trigger}
          aria-label={`${props.property.name} summary`}
          onClick={() => setOpen((v) => !v)}
        >
          <Show
            when={props.aggregation !== "none"}
            fallback={<span data-hint>Calculate</span>}
          >
            <span>
              {AGGREGATION_LABELS[props.aggregation].replace(/ all$/, "")}
            </span>
            <span class={value}>{text()}</span>
          </Show>
        </button>
      }
    >
      <div class={menuPanel}>
        <For each={aggregationsFor(props.property.kind)}>
          {(kind) => (
            <MenuItem
              trailing={
                kind === props.aggregation ? <CheckIcon size={13} /> : undefined
              }
              onClick={() => {
                props.onChange(kind);
                setOpen(false);
              }}
            >
              {AGGREGATION_LABELS[kind]}
            </MenuItem>
          )}
        </For>
      </div>
    </SimplePopover>
  );
};
