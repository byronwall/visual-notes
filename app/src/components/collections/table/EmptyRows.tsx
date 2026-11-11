import { SearchXIcon } from "lucide-solid";
import { Show } from "solid-js";
import { css } from "styled-system/css";
import type { CollectionView } from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";

// Pinned to the scroller's visible width (the grid can be much wider) so the
// message stays centered on screen while the table scrolls sideways.
const root = css({
  position: "sticky",
  left: "0",
  w: "100cqw",
  maxW: "full",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "2",
  px: "3",
  py: "6",
  color: "fg.muted",
  fontSize: "sm",
  textAlign: "center",
});
const message = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  color: "fg.default",
  fontWeight: "medium",
  overflowWrap: "anywhere",
});
const actions = css({ display: "flex", gap: "2", flexWrap: "wrap" });
const action = css({
  h: "7",
  px: "2.5",
  borderRadius: "l2",
  borderWidth: "1px",
  borderColor: "border",
  bg: "bg.default",
  color: "fg.default",
  fontSize: "sm",
  cursor: "pointer",
  transition: "background-color 140ms",
  _hover: { bg: "bg.subtle" },
  _active: { bg: "bg.muted" },
});

/** Shown when the view hides every row: names the cause and offers the fix. */
export const EmptyRows = (props: { view: CollectionView }) => {
  const { store } = useCollection();
  const search = () => store.effectiveConfig(props.view).search?.trim() ?? "";
  const filterCount = () => props.view.config.filter?.items.length ?? 0;
  const clearSearch = () => {
    store.setSearch(props.view.id, "");
    if (props.view.config.search)
      store.patchViewConfig(props.view.id, { search: undefined });
  };
  const clearFilters = () =>
    store.patchViewConfig(props.view.id, { filter: undefined });

  return (
    <div class={root} role="status">
      <div class={message}>
        <SearchXIcon size={15} />
        <Show
          when={search()}
          fallback={
            filterCount()
              ? `No rows match ${filterCount() === 1 ? "the filter" : `${filterCount()} filters`}`
              : "No rows match this view"
          }
        >
          No rows match “{search()}”
        </Show>
      </div>
      <Show when={search() && filterCount()}>
        <span>
          {filterCount() === 1 ? "A filter" : `${filterCount()} filters`} also
          apply.
        </span>
      </Show>
      <div class={actions}>
        <Show when={search()}>
          <button type="button" class={action} onClick={clearSearch}>
            Clear search
          </button>
        </Show>
        <Show when={filterCount()}>
          <button type="button" class={action} onClick={clearFilters}>
            Clear filters
          </button>
        </Show>
      </div>
    </div>
  );
};
