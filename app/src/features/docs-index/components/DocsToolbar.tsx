import { createMemo } from "solid-js";
import { ActivityIcon, ArrowUpDownIcon } from "lucide-solid";
import type { SimpleSelectItem } from "~/components/ui/simple-select";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Box, HStack } from "styled-system/jsx";
import type { DocsQueryStore } from "../state/docsQuery";
import { FiltersPopover } from "./FiltersPopover";
import {
  ActiveFilterTokens,
  useActiveFilterTokens,
} from "./ActiveFilterTokens";

type SortMode = ReturnType<DocsQueryStore["sortMode"]>;

const activityClassItems: SimpleSelectItem[] = [
  { label: "Any activity", value: "" },
  { label: "Read-heavy", value: "READ_HEAVY" },
  { label: "Edit-heavy", value: "EDIT_HEAVY" },
  { label: "Balanced", value: "BALANCED" },
  { label: "Cold", value: "COLD" },
];

export const DocsToolbar = (props: {
  q: DocsQueryStore;
  isSearching: boolean;
  sources?: { originalSource: string; count: number }[];
}) => {
  const q = props.q;
  const tokens = useActiveFilterTokens(q);
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
    <HStack gap="1.5" minW="0" flex="1">
      <HStack gap="1" flexShrink="0">
        <Box color="fg.subtle" display="flex">
          <ArrowUpDownIcon size={13} />
        </Box>
        <SimpleSelect
          items={sortItems()}
          value={q.sortMode()}
          onChange={(value) => q.setSortMode(value as SortMode)}
          size="xs"
          minW="9.5rem"
          sameWidth
          skipPortal={false}
        />
      </HStack>
      <HStack gap="1" flexShrink="0" smDown={{ display: "none" }}>
        <Box color="fg.subtle" display="flex">
          <ActivityIcon size={13} />
        </Box>
        <SimpleSelect
          items={activityClassItems}
          value={q.activityClass()}
          placeholder="Any activity"
          onChange={(value) => q.setActivityClass(value)}
          size="xs"
          minW="8rem"
          sameWidth
          skipPortal={false}
        />
      </HStack>
      <FiltersPopover
        q={q}
        sources={props.sources}
        activeCount={tokens().length}
      />
      <Box display="flex" gap="1.5" minW="0" overflow="hidden">
        <ActiveFilterTokens tokens={tokens()} />
      </Box>
    </HStack>
  );
};
