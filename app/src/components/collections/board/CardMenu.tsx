import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  EllipsisIcon,
  PanelRightOpenIcon,
} from "lucide-solid";
import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import { SimplePopover } from "~/components/ui/simple-popover";
import type { BoardGroup } from "~/lib/collections/group";
import type { CollectionProperty } from "~/lib/collections/types";
import {
  MenuItem,
  menuPanel,
  menuSection,
  menuSeparator,
} from "../menu/MenuList";
import { fitContent } from "../popover-styles";
import { OptionChip } from "../values/OptionChip";

export const NONE = "__none__";

// Shows on card hover or focus; always shows where there is no hover (touch).
const anchorCls = css({ position: "absolute", top: "1.5", right: "1.5" });
const trigger = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxSize: "6",
  borderRadius: "l1",
  color: "fg.subtle",
  bg: "bg.default",
  cursor: "pointer",
  opacity: "0",
  transitionProperty: "opacity, color, background-color",
  transitionDuration: "140ms",
  _hover: { color: "fg.default", bg: "bg.muted" },
  _focusVisible: { opacity: "1" },
  "[data-card-id]:hover &": { opacity: "1" },
  "[data-card-id]:focus-within &": { opacity: "1" },
  "&[data-open]": { opacity: "1" },
  "@media (hover: none)": { opacity: "1" },
});

/** The "…" menu on a board card: open, move to another column, reorder. */
export const CardMenu = (props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: BoardGroup[];
  property: CollectionProperty;
  currentKey: string;
  /** Up/down only make sense while the board keeps manual order. */
  canReorder: boolean;
  isFirst: boolean;
  isLast: boolean;
  onOpenRow: () => void;
  onMoveTo: (key: string) => void;
  onShift: (delta: -1 | 1) => void;
}) => {
  return (
    <SimplePopover
      class={fitContent}
      open={props.open}
      onClose={() => props.onOpenChange(false)}
      placement="bottom-end"
      anchorClass={anchorCls}
      anchor={
        <button
          type="button"
          class={trigger}
          aria-label="Card actions"
          aria-haspopup="menu"
          data-open={props.open ? "" : undefined}
          // Keep the press from starting a drag or opening the card.
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            props.onOpenChange(!props.open);
          }}
        >
          <EllipsisIcon size={14} />
        </button>
      }
    >
      <div class={menuPanel} style={{ width: "14rem" }}>
        <MenuItem
          icon={<PanelRightOpenIcon size={14} />}
          onClick={() => {
            props.onOpenChange(false);
            props.onOpenRow();
          }}
        >
          Open
        </MenuItem>
        <Show when={props.canReorder}>
          <MenuItem
            icon={<ArrowUpIcon size={14} />}
            disabled={props.isFirst}
            onClick={() => {
              props.onOpenChange(false);
              props.onShift(-1);
            }}
          >
            Move up
          </MenuItem>
          <MenuItem
            icon={<ArrowDownIcon size={14} />}
            disabled={props.isLast}
            onClick={() => {
              props.onOpenChange(false);
              props.onShift(1);
            }}
          >
            Move down
          </MenuItem>
        </Show>
        <div class={menuSeparator} />
        <div class={menuSection}>Move to</div>
        <For each={props.groups}>
          {(group) => {
            const key = () => group.key ?? NONE;
            return (
              <MenuItem
                trailing={
                  key() === props.currentKey ? (
                    <CheckIcon size={13} />
                  ) : undefined
                }
                onClick={() => {
                  props.onOpenChange(false);
                  props.onMoveTo(key());
                }}
              >
                <Show
                  when={group.option}
                  fallback={<>No {props.property.name.toLowerCase()}</>}
                >
                  {(option) => (
                    <OptionChip
                      option={option()}
                      showDot={props.property.kind === "status"}
                    />
                  )}
                </Show>
              </MenuItem>
            );
          }}
        </For>
      </div>
    </SimplePopover>
  );
};
