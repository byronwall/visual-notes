import { Show, For, createMemo, createEffect } from "solid-js";
import { groupByUpdatedAt } from "../utils/grouping";
import { DocRow } from "./DocRow";
import { computeFuzzyScore } from "../utils/fuzzy";
import { LoadMoreButton } from "./LoadMoreButton";
import { createDocsQueryStore } from "../state/docsQuery";
import { useDocPreviewMap } from "../hooks/useDocPreviewMap";
import { Text } from "~/components/ui/text";
import { Spinner } from "~/components/ui/spinner";
import { Box, HStack, Stack } from "styled-system/jsx";

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
  const previewDocsById = useDocPreviewMap(visibleIds);

  createEffect(() => {
    try {
      if (props.onVisibleIdsChange) props.onVisibleIdsChange(visibleIds());
    } catch {}
  });

  return (
    <Stack gap="1.5rem" mt="1rem">
      <Show
        when={!isSearching()}
        fallback={
          <>
            <Box as="section">
              <Text fontSize="sm" fontWeight="semibold" color="black.a7">
                Client results – title match
              </Text>
              <For
                each={groupByUpdatedAt(
                  clientMatches().slice(0, q.clientShown())
                )}
              >
                {(g) => (
                  <Show when={g.items.length}>
                    <Box as="section">
                      <Text fontSize="xs" fontWeight="semibold" color="black.a7">
                        {g.label}
                      </Text>
                      <Stack as="ul" gap="0.5rem" mt="0.25rem">
                        <For each={g.items}>
                          {(d) => (
                            <DocRow
                              {...d}
                              query={q.searchText()}
                              previewDoc={previewDocsById().get(d.id) || null}
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
                      </Stack>
                    </Box>
                  </Show>
                )}
              </For>
              <LoadMoreButton
                shown={Math.min(q.clientShown(), clientMatches().length)}
                total={clientMatches().length}
                onClick={() => q.showMoreClient(100)}
              />
            </Box>

            <Box as="section">
              <Text fontSize="sm" fontWeight="semibold" color="black.a7">
                Server results – full text
              </Text>
              <Show when={props.serverLoading}>
                <HStack gap="0.5rem" mt="0.5rem">
                  <Spinner />
                  <Text fontSize="sm" color="black.a7">
                    Searching…
                  </Text>
                </HStack>
              </Show>
              <Stack as="ul" gap="0.5rem" mt="0.5rem">
                <For each={props.serverResults.slice(0, q.serverShown())}>
                  {(d) => (
                    <DocRow
                      {...d}
                      query={q.searchText()}
                      previewDoc={previewDocsById().get(d.id) || null}
                      selected={props.selectedIds?.has(d.id)}
                      onToggleSelect={props.onToggleSelect}
                    />
                  )}
                </For>
              </Stack>
              <LoadMoreButton
                shown={Math.min(q.serverShown(), props.serverResults.length)}
                total={props.serverResults.length}
                onClick={() => q.showMoreServer(25)}
              />
            </Box>
          </>
        }
      >
        <Stack gap="1.5rem">
          <Text fontSize="sm" color="black.a7">
            Total results: {props.items.length}
          </Text>
          <For each={groupByUpdatedAt(props.items.slice(0, q.clientShown()))}>
            {(g) => (
              <Show when={g.items.length}>
                <Box as="section">
                  <Text fontSize="sm" fontWeight="semibold" color="black.a7">
                    {g.label}
                  </Text>
                  <Stack as="ul" gap="0.5rem" mt="0.5rem">
                    <For each={g.items}>
                      {(d) => (
                        <DocRow
                          {...d}
                          previewDoc={previewDocsById().get(d.id) || null}
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
                  </Stack>
                </Box>
              </Show>
            )}
          </For>
          <LoadMoreButton
            shown={Math.min(q.clientShown(), props.items.length)}
            total={props.items.length}
            onClick={() => q.showMoreClient(100)}
          />
        </Stack>
      </Show>
    </Stack>
  );
};
