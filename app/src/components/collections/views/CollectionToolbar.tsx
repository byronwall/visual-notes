import {
  ArrowUpDownIcon,
  ListFilterIcon,
  ListIcon,
  PlusIcon,
} from "lucide-solid";
import { type JSX, Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { SimplePopover } from "~/components/ui/simple-popover";
import type {
  CollectionView,
  FilterGroup,
  FilterTree,
} from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";
import { fitContent } from "../popover-styles";
import { FilterEditor } from "./FilterEditor";
import { PropertiesMenu } from "./PropertiesMenu";
import { SaveState } from "./SaveState";
import { SortEditor } from "./SortEditor";
import { ToolbarSearch } from "./ToolbarSearch";
import { toolbarBtn } from "./toolbar-styles";

const NARROW = "@container coltoolbar (max-width: 35rem)";

// One fixed-height row at every width; the bulk bar overlays it exactly.
const frame = css({
  containerType: "inline-size",
  containerName: "coltoolbar",
});
const bar = css({
  display: "flex",
  alignItems: "center",
  gap: "1",
  h: "8",
  minW: "0",
  [NARROW]: { gap: "0.5" },
});
const countText = css({
  fontSize: "xs",
  fontWeight: "semibold",
  fontVariantNumeric: "tabular-nums",
});
// View-type settings (board grouping, calendar date) come from ViewSettings,
// whose buttons carry their own text. Narrow: hide the text, keep the icon.
const settingsSlot = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  minW: "0",
  "&:empty": { display: "none" },
  "& button": { whiteSpace: "nowrap" },
  [NARROW]: {
    gap: "0.5",
    "& button": { fontSize: "0", gap: "0", px: "1.5" },
  },
});
const spacer = css({ flex: "1", minW: "0" });
const trailingSlot = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  flexShrink: "0",
  "&:empty": { display: "none" },
});
const newBtn = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  flexShrink: "0",
  h: "7",
  px: "2.5",
  borderRadius: "l2",
  bg: "fg.default",
  color: "bg.default",
  fontSize: "sm",
  fontWeight: "medium",
  cursor: "pointer",
  transition: "opacity 140ms",
  _hover: { opacity: "0.9" },
});

const countConditions = (filter: FilterTree | undefined) =>
  (filter?.items ?? []).reduce(
    (n, item) =>
      n + ("conditions" in item ? (item as FilterGroup).conditions.length : 1),
    0,
  );

/** A toolbar button whose label hides on a narrow toolbar; the count stays. */
const ToolButton = (props: {
  icon: JSX.Element;
  label: string;
  count?: number;
  expanded: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    class={toolbarBtn}
    data-active={props.count ? "" : undefined}
    aria-label={props.count ? `${props.label} (${props.count})` : props.label}
    aria-expanded={props.expanded}
    title={props.label}
    onClick={() => props.onClick()}
  >
    {props.icon}
    <span data-label>{props.label}</span>
    <Show when={props.count}>
      <span class={countText}>{props.count}</span>
    </Show>
  </button>
);

/** Search, filter, sort, and property visibility for the active view. */
export const CollectionToolbar = (props: {
  view: CollectionView;
  /** View-type settings, such as board grouping or calendar date. */
  settings?: JSX.Element;
  /**
   * Small controls just before New, such as a save-state indicator or a
   * layout toggle. Keep each one icon-sized; the row never wraps.
   */
  trailing?: JSX.Element;
  onNew?: () => void;
}) => {
  const { store } = useCollection();
  const [open, setOpen] = createSignal<"filter" | "sort" | "props" | null>(
    null,
  );
  const filterCount = () => countConditions(props.view.config.filter);
  const sortCount = () => props.view.config.sorts?.length ?? 0;
  const toggle = (which: "filter" | "sort" | "props") =>
    setOpen((cur) => (cur === which ? null : which));

  return (
    <div class={frame}>
      <div class={bar}>
        <ToolbarSearch viewId={props.view.id} />
        <SimplePopover
          class={fitContent}
          open={open() === "filter"}
          onClose={() => setOpen(null)}
          anchor={
            <ToolButton
              icon={<ListFilterIcon size={14} />}
              label="Filter"
              count={filterCount()}
              expanded={open() === "filter"}
              onClick={() => toggle("filter")}
            />
          }
        >
          <FilterEditor
            properties={store.state.properties}
            filter={props.view.config.filter}
            onChange={(filter) =>
              store.patchViewConfig(props.view.id, { filter })
            }
          />
        </SimplePopover>
        <SimplePopover
          class={fitContent}
          open={open() === "sort"}
          onClose={() => setOpen(null)}
          anchor={
            <ToolButton
              icon={<ArrowUpDownIcon size={14} />}
              label="Sort"
              count={sortCount()}
              expanded={open() === "sort"}
              onClick={() => toggle("sort")}
            />
          }
        >
          <SortEditor
            properties={store.state.properties}
            sorts={props.view.config.sorts}
            onChange={(sorts) =>
              store.patchViewConfig(props.view.id, { sorts })
            }
          />
        </SimplePopover>
        <SimplePopover
          class={fitContent}
          open={open() === "props"}
          onClose={() => setOpen(null)}
          anchor={
            <ToolButton
              icon={<ListIcon size={14} />}
              label="Properties"
              expanded={open() === "props"}
              onClick={() => toggle("props")}
            />
          }
        >
          <PropertiesMenu view={props.view} />
        </SimplePopover>
        <span class={settingsSlot}>{props.settings}</span>
        <span class={spacer} />
        <span class={trailingSlot} data-toolbar-trailing>
          <SaveState viewId={props.view.id} />
          {props.trailing}
        </span>
        <Show when={props.onNew}>
          <button type="button" class={newBtn} onClick={() => props.onNew?.()}>
            <PlusIcon size={14} /> New
          </button>
        </Show>
      </div>
    </div>
  );
};
