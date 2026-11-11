import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  PlusIcon,
  TableIcon,
} from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { Dynamic } from "solid-js/web";
import { css } from "styled-system/css";
import { SimplePopover } from "~/components/ui/simple-popover";
import type { ViewType } from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";
import {
  MenuItem,
  menuPanel,
  menuSection,
  menuSeparator,
} from "../menu/MenuList";
import { fitContent } from "../popover-styles";
import { AddViewItems } from "./ViewOptions";
import { VIEW_ICONS } from "./view-meta";

const trigger = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  minW: "0",
  maxW: "16rem",
  h: "7",
  px: "2",
  borderRadius: "l2",
  fontSize: "sm",
  fontWeight: "medium",
  whiteSpace: "nowrap",
  color: "fg.default",
  cursor: "pointer",
  transition: "background-color 140ms",
  _hover: { bg: "bg.muted" },
  "&[aria-expanded=true]": { bg: "bg.muted" },
  "& > span": { overflow: "hidden", textOverflow: "ellipsis" },
  "& > svg": { flexShrink: "0" },
});
const listPanel = css({ maxH: "min(70vh, 28rem)", overflowY: "auto" });

/** Narrow layout: one button with the active view that lists every view. */
export const CompactViewSwitcher = (props: {
  activeViewId?: string;
  onSelect: (viewId: string) => void;
  onAdd: (type: ViewType) => void;
}) => {
  const { store } = useCollection();
  const [open, setOpen] = createSignal(false);
  const [adding, setAdding] = createSignal(false);
  const active = () =>
    store.state.views.find((v) => v.id === props.activeViewId);
  const close = () => {
    setOpen(false);
    setAdding(false);
  };
  return (
    <SimplePopover
      class={fitContent}
      open={open()}
      onClose={close}
      anchorClass={css({ display: "inline-flex", minW: "0" })}
      anchor={
        <button
          type="button"
          class={trigger}
          data-view-switcher=""
          aria-haspopup="menu"
          aria-expanded={open()}
          aria-label={`View: ${active()?.name ?? ""}. Switch view`}
          onClick={() => (open() ? close() : setOpen(true))}
        >
          <Dynamic
            component={active() ? VIEW_ICONS[active()!.type] : TableIcon}
            size={14}
          />
          <span>{active()?.name}</span>
          <ChevronDownIcon size={12} />
        </button>
      }
    >
      <div class={`${menuPanel} ${listPanel}`} style={{ width: "16rem" }}>
        <Show
          when={!adding()}
          fallback={
            <>
              <MenuItem
                icon={<ChevronLeftIcon size={14} />}
                onClick={() => setAdding(false)}
              >
                Add a view
              </MenuItem>
              <AddViewItems
                onAdd={(type) => {
                  close();
                  props.onAdd(type);
                }}
              />
            </>
          }
        >
          <div class={menuSection}>Views</div>
          <For each={store.state.views}>
            {(view) => (
              <MenuItem
                icon={<Dynamic component={VIEW_ICONS[view.type]} size={14} />}
                selected={view.id === props.activeViewId}
                trailing={
                  view.id === props.activeViewId ? (
                    <CheckIcon size={14} />
                  ) : undefined
                }
                onClick={() => {
                  close();
                  props.onSelect(view.id);
                }}
              >
                {view.name}
              </MenuItem>
            )}
          </For>
          <div class={menuSeparator} />
          <MenuItem
            icon={<PlusIcon size={14} />}
            onClick={() => setAdding(true)}
          >
            Add view
          </MenuItem>
        </Show>
      </div>
    </SimplePopover>
  );
};
