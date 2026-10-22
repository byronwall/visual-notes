import { For, Match, Show, Switch, createEffect, createMemo } from "solid-js";
import { groupByUpdatedAt } from "../utils/grouping";
import { DocRow, docRowListClass } from "./DocRow";
import { LoadMoreButton } from "./LoadMoreButton";
import { ListEmptyState } from "./ListEmptyState";
import { type createDocsQueryStore } from "../state/docsQuery";
import type {
  DocListItem,
  DocsSummary,
  ServerSearchItem,
} from "../data/docs.types";
import { Box } from "styled-system/jsx";
import { css } from "styled-system/css";

type Group = {
  key: string;
  label: string;
  /** Matches in this heading across all pages, not just the loaded rows. */
  count?: number;
  items: (DocListItem | ServerSearchItem)[];
};

// Space between periods lives on the section, so a stuck heading stays slim.
const sectionClass = css({ p: "0", "& + &": { mt: "3" } });

// Headings stick under the page header, so a long scroll always says which
// period is on screen. The fallback matches the desktop header before it is
// measured.
const groupLabelClass = css({
  position: "sticky",
  top: "var(--docs-index-header-h, 6.25rem)",
  zIndex: "docked",
  bg: "bg.default",
  display: "flex",
  alignItems: "baseline",
  gap: "2",
  pt: "1.5",
  pb: "1",
  fontSize: "xs",
  fontWeight: "semibold",
  color: "fg.muted",
});

// Rows bleed 8px into the gutter so titles line up with the page heading.
const listClass = css({
  mx: "-2",
  display: "flex",
  flexDirection: "column",
  gap: "px",
  transitionProperty: "opacity",
  transitionDuration: "160ms",
  "&[data-stale]": { opacity: 0.55 },
});

export const ResultsSection = (props: {
  items: DocListItem[];
  summary?: DocsSummary;
  onShowMore: () => void | Promise<void>;
  loadingMore?: boolean;
  query: ReturnType<typeof createDocsQueryStore>;
  serverResults: ServerSearchItem[];
  serverLoading: boolean;
  /** Results on screen answer an older query; dim them until the new ones land. */
  serverStale?: boolean;
  serverError?: "request" | "timeout";
  onSearchRetry: () => void;
  onVisibleIdsChange?: (ids: string[]) => void;
  selectedIds?: Set<string>;
  activeId?: string | null;
  hasFilters: boolean;
  onClearFilters: () => void;
  onToggleSelect?: (id: string, next: boolean, shiftKey: boolean) => void;
  onActivate?: (id: string) => void;
  onResultOpen?: (id: string) => void;
}) => {
  const q = props.query;
  const nowMs = () => props.summary?.nowMs ?? Date.now();
  const isSearching = () => q.searchText().trim().length > 0;
  // Only "relevance" browses by last update, so date buckets match the order.
  const isGrouped = () => !isSearching() && q.sortMode() === "relevance";

  const searchResults = createMemo(() => {
    const seen = new Set<string>();
    const out: ServerSearchItem[] = [];
    for (const item of props.serverResults) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    return out;
  });

  const groups = createMemo<Group[]>(() => {
    if (isSearching()) {
      return [
        { key: "", label: "", items: searchResults().slice(0, q.serverShown()) },
      ];
    }
    if (!isGrouped()) return [{ key: "", label: "", items: props.items }];
    const counts = props.summary?.bucketCounts ?? {};
    return groupByUpdatedAt(props.items, nowMs()).map((g) => ({
      ...g,
      count: counts[g.key] ?? g.items.length,
    }));
  });

  const groupKeys = createMemo(() => groups().map((g) => g.key));
  const groupsByKey = createMemo(
    () => new Map(groups().map((g) => [g.key, g])),
  );

  const visibleIds = createMemo(() =>
    groups().flatMap((g) => g.items.map((x) => x.id)),
  );
  const selectionMode = () => (props.selectedIds?.size ?? 0) > 0;

  createEffect(() => props.onVisibleIdsChange?.(visibleIds()));

  const totalCount = () =>
    isSearching()
      ? searchResults().length
      : (props.summary?.total ?? props.items.length);
  const shownCount = () =>
    isSearching()
      ? Math.min(q.serverShown(), totalCount())
      : props.items.length;

  const onFilterMeta = (k: string, v: string) => {
    q.setMetaKey(k);
    q.setMetaValue(v);
  };

  return (
    <Switch>
      <Match when={isSearching() && props.serverError}>
        {(error) => (
          <ListEmptyState
            tone="error"
            message={
              error() === "timeout" ? "Search timed out." : "Search failed."
            }
            actionLabel="Retry"
            onAction={props.onSearchRetry}
          />
        )}
      </Match>
      <Match when={totalCount() === 0}>
        <ListEmptyState
          message={
            isSearching()
              ? props.serverLoading
                ? "Searching…"
                : `No notes match “${q.searchText().trim()}”.`
              : props.hasFilters
                ? "No notes match these filters."
                : "No notes yet."
          }
          actionLabel={
            !props.serverLoading && props.hasFilters
              ? "Clear filters"
              : undefined
          }
          onAction={props.onClearFilters}
        />
      </Match>
      <Match when={true}>
        <Box>
          {/* Keyed by heading so appending a page keeps mounted rows. */}
          <For each={groupKeys()}>
            {(key) => {
              const g = () => groupsByKey().get(key)!;
              return (
              <section class={sectionClass}>
                <Show when={g().label}>
                  <h2 class={groupLabelClass}>
                    {g().label}
                    <Box
                      as="span"
                      fontWeight="normal"
                      color="fg.subtle"
                      fontVariantNumeric="tabular-nums"
                    >
                      {g().count?.toLocaleString()}
                    </Box>
                  </h2>
                </Show>
                <ul
                  class={`${listClass} ${docRowListClass}`}
                  data-stale={
                    isSearching() && props.serverStale ? "" : undefined
                  }
                >
                  <For each={g().items}>
                    {(d) => (
                      <DocRow
                        id={d.id}
                        title={d.title}
                        updatedAt={d.updatedAt}
                        path={d.path}
                        meta={d.meta}
                        share={d.share}
                        collection={d.collection}
                        snippet={"snippet" in d ? d.snippet : undefined}
                        query={isSearching() ? q.searchText() : undefined}
                        nowMs={nowMs()}
                        active={props.activeId === d.id}
                        selected={props.selectedIds?.has(d.id)}
                        selectionMode={selectionMode()}
                        onResultOpen={
                          isSearching() ? props.onResultOpen : undefined
                        }
                        onFilterMeta={onFilterMeta}
                        onToggleSelect={props.onToggleSelect}
                        onActivate={props.onActivate}
                      />
                    )}
                  </For>
                </ul>
              </section>
              );
            }}
          </For>
          <LoadMoreButton
            shown={shownCount()}
            total={totalCount()}
            loading={!isSearching() && props.loadingMore}
            onLoadMore={() =>
              isSearching() ? q.showMoreServer(25) : void props.onShowMore()
            }
          />
        </Box>
      </Match>
    </Switch>
  );
};
