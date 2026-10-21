import {
  ArrowUpDownIcon,
  ListFilterIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
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
import { FilterEditor } from "./FilterEditor";
import { PropertiesMenu } from "./PropertiesMenu";
import { SortEditor } from "./SortEditor";
import { fitContent } from "../popover-styles";

const bar = css({
  display: "flex",
  alignItems: "center",
  gap: "1",
  flexWrap: "wrap",
  minH: "8",
});
const btn = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  h: "7",
  px: "2",
  borderRadius: "l2",
  color: "fg.muted",
  fontSize: "sm",
  cursor: "pointer",
  _hover: { bg: "bg.muted", color: "fg.default" },
  "&[data-active]": { color: "blue.11", bg: "blue.a3" },
});
const searchBox = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  h: "7",
  px: "2",
  borderRadius: "l2",
  color: "fg.muted",
  borderWidth: "1px",
  borderColor: "transparent",
  "&:focus-within": { borderColor: "border", bg: "bg.default" },
  "& input": {
    outline: "none",
    bg: "transparent",
    fontSize: "sm",
    w: "8rem",
    color: "fg.default",
  },
});
const spacer = css({ flex: "1" });
const newBtn = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  h: "7",
  px: "2.5",
  borderRadius: "l2",
  bg: "fg.default",
  color: "bg.default",
  fontSize: "sm",
  fontWeight: "medium",
  cursor: "pointer",
  _hover: { opacity: "0.9" },
});

const countConditions = (filter: FilterTree | undefined) =>
  (filter?.items ?? []).reduce(
    (n, item) =>
      n + ("conditions" in item ? (item as FilterGroup).conditions.length : 1),
    0,
  );

/** Search, filter, sort, and property visibility for the active view. */
export const CollectionToolbar = (props: {
  view: CollectionView;
  /** View-type settings, such as board grouping or calendar date. */
  settings?: JSX.Element;
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
    <div class={bar}>
      <label class={searchBox}>
        <SearchIcon size={14} />
        <input
          placeholder="Search"
          aria-label="Search this view"
          value={store.search(props.view.id)}
          onInput={(e) => store.setSearch(props.view.id, e.currentTarget.value)}
          onKeyDown={(e) =>
            e.key === "Escape" && store.setSearch(props.view.id, "")
          }
        />
        <Show when={store.search(props.view.id)}>
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => store.setSearch(props.view.id, "")}
          >
            <XIcon size={12} />
          </button>
        </Show>
      </label>
      <SimplePopover
        class={fitContent}
        open={open() === "filter"}
        onClose={() => setOpen(null)}
        anchor={
          <button
            type="button"
            class={btn}
            data-active={filterCount() ? "" : undefined}
            onClick={() => toggle("filter")}
          >
            <ListFilterIcon size={14} /> Filter
            {filterCount() ? ` · ${filterCount()}` : ""}
          </button>
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
          <button
            type="button"
            class={btn}
            data-active={sortCount() ? "" : undefined}
            onClick={() => toggle("sort")}
          >
            <ArrowUpDownIcon size={14} /> Sort
            {sortCount() ? ` · ${sortCount()}` : ""}
          </button>
        }
      >
        <SortEditor
          properties={store.state.properties}
          sorts={props.view.config.sorts}
          onChange={(sorts) => store.patchViewConfig(props.view.id, { sorts })}
        />
      </SimplePopover>
      <SimplePopover
        class={fitContent}
        open={open() === "props"}
        onClose={() => setOpen(null)}
        anchor={
          <button type="button" class={btn} onClick={() => toggle("props")}>
            <ListIcon size={14} /> Properties
          </button>
        }
      >
        <PropertiesMenu view={props.view} />
      </SimplePopover>
      {props.settings}
      <span class={spacer} />
      <Show when={props.onNew}>
        <button type="button" class={newBtn} onClick={() => props.onNew?.()}>
          <PlusIcon size={14} /> New
        </button>
      </Show>
    </div>
  );
};
