import { Show, createMemo } from "solid-js";
import { ArrowUpDownIcon, ListFilterIcon } from "lucide-solid";
import { Button } from "~/components/ui/button";
import type { SimpleSelectItem } from "~/components/ui/simple-select";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Box, HStack } from "styled-system/jsx";
import type { DocsFacets, SortMode } from "../data/docs.types";
import type { DocsQueryStore } from "../state/docsQuery";
import {
  ActiveFilterTokens,
  useActiveFilterTokens,
} from "./ActiveFilterTokens";
import { CollectionRowsToggle } from "./CollectionRowsToggle";

export const DocsToolbar = (props: {
  q: DocsQueryStore;
  isSearching: boolean;
  facets?: DocsFacets;
  onOpenFilters: () => void;
}) => {
  const q = props.q;
  const tokens = useActiveFilterTokens(
    q,
    (id) => props.facets?.collections.find((c) => c.value === id)?.name,
  );
  // "relevance" means rank while searching and last-updated while browsing.
  const sortItems = createMemo<SimpleSelectItem[]>(() => [
    {
      label: props.isSearching ? "Best match" : "Last updated",
      value: "relevance",
    },
    { label: "Recent activity", value: "recent_activity" },
    { label: "Most viewed (30d)", value: "most_viewed_30d" },
    { label: "Most edited (30d)", value: "most_edited_30d" },
  ]);

  return (
    <HStack gap="1.5" minW="0" flex="1" flexWrap="wrap" rowGap="1">
      <HStack gap="1" flexShrink="0">
        <Box color="fg.subtle" display="flex" hideBelow="sm">
          <ArrowUpDownIcon size={13} />
        </Box>
        <SimpleSelect
          items={sortItems()}
          value={q.sortMode()}
          onChange={(value) => q.setSortMode(value as SortMode)}
          size="xs"
          minW="8rem"
          sameWidth
          skipPortal={false}
        />
      </HStack>
      {/* From `xl` up the rail is always on screen. */}
      <Box hideFrom="xl">
        <Button
          size="xs"
          variant={tokens().length > 0 ? "subtle" : "outline"}
          fontWeight="normal"
          onClick={props.onOpenFilters}
        >
          <ListFilterIcon size={14} />
          Filter
          <Show when={tokens().length > 0}>
            <Box as="span" color="fg.muted" fontVariantNumeric="tabular-nums">
              {tokens().length}
            </Box>
          </Show>
        </Button>
      </Box>
      <ActiveFilterTokens tokens={tokens()} />
      <Box ml="auto" display="flex">
        <CollectionRowsToggle
          q={q}
          hiddenCount={props.facets?.hiddenCollectionRows}
        />
      </Box>
    </HStack>
  );
};
