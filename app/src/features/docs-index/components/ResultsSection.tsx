import { Show, For, createMemo, createEffect } from "solid-js";
import { groupByUpdatedAt } from "../utils/grouping";
import { DocRow } from "./DocRow";
import { computeFuzzyScore } from "../utils/fuzzy";
import { LoadMoreButton } from "./LoadMoreButton";
import { createDocsQueryStore } from "../state/docsQuery";

export const ResultsSection = (props: {
  items: any[];
  query: ReturnType<typeof createDocsQueryStore>;
  serverResults: any[];
  serverLoading: boolean;
  onVisibleIdsChange?: (ids: string[]) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string, next: boolean) => void;
}) => {
  const q = props.query;

  const clientMatches = createMemo(() => {
    const qtext = q.searchText().trim().toLowerCase();
    if (!qtext) return props.items;
    const scored = props.items
      .map((it) => ({
        it,
        s: computeFuzzyScore((it.title || "").toLowerCase(), qtext),
      }))
      .filter((x) => x.s > 0)
      .sort(
        (a, b) =>
          b.s - a.s ||
          new Date(b.it.updatedAt).getTime() -
            new Date(a.it.updatedAt).getTime()
      )
      .map((x) => x.it);
    return scored;
  });

  const isSearching = () => q.searchText().trim().length > 0;

  const visibleIds = createMemo(() => {
    if (isSearching()) {
      const clientIds = groupByUpdatedAt(
        clientMatches().slice(0, q.clientShown())
      )
        .flatMap((g) => g.items)
        .map((x) => x.id);
      const serverIds = props.serverResults
        .slice(0, q.serverShown())
        .map((x) => x.id);
      // de-dupe while preserving order: client first then server
      const seen = new Set<string>();
      const out: string[] = [];
      for (const id of [...clientIds, ...serverIds]) {
        if (!seen.has(id)) {
          seen.add(id);
          out.push(id);
        }
      }
      return out;
    } else {
      return groupByUpdatedAt(props.items.slice(0, q.clientShown()))
        .flatMap((g) => g.items)
        .map((x) => x.id);
    }
  });

  createEffect(() => {
    try {
      if (props.onVisibleIdsChange) props.onVisibleIdsChange(visibleIds());
    } catch {}
  });

  return (
    <div class="space-y-6 mt-4">
      <Show
        when={!isSearching()}
        fallback={
          <>
            <section>
              <h2 class="text-sm font-semibold text-gray-600">
                Client results – title match
              </h2>
              <For
                each={groupByUpdatedAt(
                  clientMatches().slice(0, q.clientShown())
                )}
              >
                {(g) => (
                  <Show when={g.items.length}>
                    <section>
                      <h3 class="text-xs font-semibold text-gray-500">
                        {g.label}
                      </h3>
                      <ul class="space-y-2 mt-1">
                        <For each={g.items}>
                          {(d) => (
                            <DocRow
                              {...d}
                              query={q.searchText()}
                              onFilterPath={(p) => q.setPathPrefix(p)}
                              onFilterMeta={(k, v) => {
                                q.setMetaKey(k);
                                q.setMetaValue(v);
                              }}
                              selected={props.selectedIds?.has(d.id)}
                              onToggleSelect={props.onToggleSelect}
                            />
                          )}
                        </For>
                      </ul>
                    </section>
                  </Show>
                )}
              </For>
              <LoadMoreButton
                shown={Math.min(q.clientShown(), clientMatches().length)}
                total={clientMatches().length}
                onClick={() => q.showMoreClient(100)}
              />
            </section>

            <section>
              <h2 class="text-sm font-semibold text-gray-600">
                Server results – full text
              </h2>
              <Show when={props.serverLoading}>
                <p class="text-sm text-gray-500 mt-2">Searching…</p>
              </Show>
              <ul class="space-y-2 mt-2">
                <For each={props.serverResults.slice(0, q.serverShown())}>
                  {(d) => (
                    <DocRow
                      {...d}
                      query={q.searchText()}
                      selected={props.selectedIds?.has(d.id)}
                      onToggleSelect={props.onToggleSelect}
                    />
                  )}
                </For>
              </ul>
              <LoadMoreButton
                shown={Math.min(q.serverShown(), props.serverResults.length)}
                total={props.serverResults.length}
                onClick={() => q.showMoreServer(25)}
              />
            </section>
          </>
        }
      >
        <div class="space-y-6">
          <div>Total results: {props.items.length}</div>
          <For each={groupByUpdatedAt(props.items.slice(0, q.clientShown()))}>
            {(g) => (
              <Show when={g.items.length}>
                <section>
                  <h2 class="text-sm font-semibold text-gray-600">{g.label}</h2>
                  <ul class="space-y-2 mt-2">
                    <For each={g.items}>
                      {(d) => (
                        <DocRow
                          {...d}
                          onFilterPath={(p) => q.setPathPrefix(p)}
                          onFilterMeta={(k, v) => {
                            q.setMetaKey(k);
                            q.setMetaValue(v);
                          }}
                          selected={props.selectedIds?.has(d.id)}
                          onToggleSelect={props.onToggleSelect}
                        />
                      )}
                    </For>
                  </ul>
                </section>
              </Show>
            )}
          </For>
          <LoadMoreButton
            shown={Math.min(q.clientShown(), props.items.length)}
            total={props.items.length}
            onClick={() => q.showMoreClient(100)}
          />
        </div>
      </Show>
    </div>
  );
};
