import { For, Match, Show, Switch, createEffect, createMemo } from "solid-js";
import { groupByUpdatedAt } from "../utils/grouping";
import { DocRow } from "./DocRow";
import { LoadMoreButton } from "./LoadMoreButton";
import { ListEmptyState } from "./ListEmptyState";
import { type createDocsQueryStore } from "../state/docsQuery";
import type { DocListItem, ServerSearchItem } from "../data/docs.types";
import { useDocPreviewMap } from "../hooks/useDocPreviewMap";
import { Box } from "styled-system/jsx";
import { css } from "styled-system/css";

type Group = { label: string; items: (DocListItem | ServerSearchItem)[] };

const groupLabelClass = css({
  display: "flex",
  alignItems: "baseline",
  gap: "2",
  px: "2",
  pt: "4",
  pb: "1",
  fontSize: "xs",
  fontWeight: "semibold",
  color: "fg.muted",
  "&:first-child": { pt: "1" },
});

const listClass = css({
  display: "flex",
  flexDirection: "column",
  gap: "px",
  transitionProperty: "opacity",
  transitionDuration: "160ms",
  "&[data-stale]": { opacity: 0.55 },
});

export const ResultsSection = (props: {
  items: DocListItem[];
  query: ReturnType<typeof createDocsQueryStore>;
  nowMs?: number;
  serverResults: ServerSearchItem[];
  serverLoading: boolean;
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
  const nowMs = () => props.nowMs ?? Date.now();
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
      return [{ label: "", items: searchResults().slice(0, q.serverShown()) }];
    }
    const shown = props.items.slice(0, q.clientShown());
    if (!isGrouped()) return [{ label: "", items: shown }];
    return groupByUpdatedAt(shown, nowMs()).filter((g) => g.items.length);
  });

  const visibleIds = createMemo(() =>
    groups().flatMap((g) => g.items.map((x) => x.id)),
  );
  const previewDocsById = useDocPreviewMap(visibleIds);
  const selectionMode = () => (props.selectedIds?.size ?? 0) > 0;

  createEffect(() => props.onVisibleIdsChange?.(visibleIds()));

  const totalCount = () =>
    isSearching() ? searchResults().length : props.items.length;
  const shownCount = () =>
    Math.min(isSearching() ? q.serverShown() : q.clientShown(), totalCount());

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
          <For each={groups()}>
            {(g) => (
              <section>
                <Show when={g.label}>
                  <h2 class={groupLabelClass}>
                    {g.label}
                    <Box as="span" fontWeight="normal" color="fg.subtle">
                      {g.items.length}
                    </Box>
                  </h2>
                </Show>
                <ul
                  class={listClass}
                  data-stale={
                    isSearching() && props.serverLoading ? "" : undefined
                  }
                >
                  <For each={g.items}>
                    {(d) => (
                      <DocRow
                        id={d.id}
                        title={d.title}
                        updatedAt={d.updatedAt}
                        path={d.path}
                        meta={d.meta}
                        share={d.share}
                        snippet={"snippet" in d ? d.snippet : undefined}
                        query={isSearching() ? q.searchText() : undefined}
                        previewDoc={previewDocsById().get(d.id) || null}
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
            )}
          </For>
          <LoadMoreButton
            shown={shownCount()}
            total={totalCount()}
            onLoadMore={() =>
              isSearching() ? q.showMoreServer(25) : q.showMoreClient(100)
            }
          />
        </Box>
      </Match>
    </Switch>
  );
};
