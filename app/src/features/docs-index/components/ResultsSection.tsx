import { Show, For, createMemo, createEffect } from "solid-js";
import { groupByUpdatedAt } from "../utils/grouping";
import { DocRow } from "./DocRow";
import { LoadMoreButton } from "./LoadMoreButton";
import { createDocsQueryStore } from "../state/docsQuery";
import type { DocListItem, ServerSearchItem } from "../data/docs.types";
import { useDocPreviewMap } from "../hooks/useDocPreviewMap";
import { ClearButton } from "~/components/ui/clear-button";
import { Text } from "~/components/ui/text";
import { Spinner } from "~/components/ui/spinner";
import { Box, HStack, Stack } from "styled-system/jsx";

export const ResultsSection = (props: {
  items: DocListItem[];
  query: ReturnType<typeof createDocsQueryStore>;
  nowMs?: number;
  serverResults: ServerSearchItem[];
  serverLoading: boolean;
  onVisibleIdsChange?: (ids: string[]) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string, next: boolean) => void;
  onResultOpen?: (id: string) => void;
}) => {
  const q = props.query;
  const nowMs = () => props.nowMs ?? Date.now();
  const isSearching = () => q.searchText().trim().length > 0;

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

  const visibleIds = createMemo(() => {
    if (isSearching()) {
      return searchResults()
        .slice(0, q.serverShown())
        .map((x) => x.id);
    }
    return groupByUpdatedAt(props.items.slice(0, q.clientShown()), nowMs())
      .flatMap((g) => g.items)
      .map((x) => x.id);
  });
  const previewDocsById = useDocPreviewMap(visibleIds);

  createEffect(() => {
    try {
      if (props.onVisibleIdsChange) props.onVisibleIdsChange(visibleIds());
    } catch {}
  });

  return (
    <Stack gap="0.4rem" mt="0">
      <Show
        when={!isSearching()}
        fallback={
          <Stack gap="0.4rem">
            <HStack justify="space-between" alignItems="center" minH="1.5rem">
              <Text fontSize="sm" fontWeight="semibold" color="black.a8">
                Search results
              </Text>
              <HStack gap="0.5rem" alignItems="center">
                <Show when={q.searchText().trim().length > 0}>
                  <ClearButton
                    label="Clear search"
                    onClick={() => {
                      q.setSearchText("");
                      q.resetPaging();
                    }}
                  />
                </Show>
                <Show when={props.serverLoading && searchResults().length === 0}>
                  <HStack gap="0.5rem">
                    <Spinner size="xs" />
                    <Text fontSize="xs" color="black.a7">
                      Searching…
                    </Text>
                  </HStack>
                </Show>
              </HStack>
            </HStack>

            <Show
              when={searchResults().length > 0}
              fallback={<EmptySearchState loading={props.serverLoading} />}
            >
              <Stack as="ul" gap="0.35rem">
                <For each={searchResults().slice(0, q.serverShown())}>
                  {(d) => (
                    <DocRow
                      {...d}
                      query={q.searchText()}
                      previewDoc={previewDocsById().get(d.id) || null}
                      onResultOpen={props.onResultOpen}
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

              <LoadMoreButton
                shown={Math.min(q.serverShown(), searchResults().length)}
                total={searchResults().length}
                onClick={() => q.showMoreServer(25)}
              />
            </Show>
          </Stack>
        }
      >
        <Stack gap="0.4rem">
          <For
            each={groupByUpdatedAt(
              props.items.slice(0, q.clientShown()),
              nowMs(),
            )}
          >
            {(g) => (
              <Show when={g.items.length}>
                <Box as="section" p={0}>
                  <Text fontSize="sm" fontWeight="semibold" color="black.a7">
                    {g.label}
                  </Text>
                  <Stack as="ul" gap="0.35rem" mt="0.1rem">
                    <For each={g.items}>
                      {(d) => (
                        <DocRow
                          {...d}
                          previewDoc={previewDocsById().get(d.id) || null}
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

const EmptySearchState = (props: { loading: boolean }) => {
  return (
    <Box
      borderWidth="1px"
      borderColor="gray.outline.border"
      borderRadius="l2"
      px="0.75rem"
      py="0.65rem"
      bg="white"
    >
      <Text fontSize="sm" color="black.a7">
        {props.loading ? "Searching notes..." : "No matching notes found."}
      </Text>
    </Box>
  );
};
