import * as Switch from "~/components/ui/switch";
import { Box } from "styled-system/jsx";
import type { DocsQueryStore } from "../state/docsQuery";
import { writeShowCollectionRows } from "../utils/collection-rows-cookie";

/** Hidden rows are one click away; the saved choice follows the user. */
export const CollectionRowsToggle = (props: {
  q: DocsQueryStore;
  hiddenCount?: number;
}) => {
  const q = props.q;
  const showing = () => !!q.collectionRows() || !!q.collectionId();

  return (
    <Switch.Root
      size="sm"
      checked={showing()}
      flexShrink="0"
      title="Rows from collections stay hidden here unless the collection turns on Always show rows."
      onCheckedChange={(details) => {
        q.setCollectionId("");
        q.setCollectionRows(details.checked ? "all" : "");
        writeShowCollectionRows(details.checked);
      }}
    >
      <Switch.HiddenInput aria-label="Show collection rows" />
      <Switch.Control />
      <Switch.Label fontSize="xs" color="fg.muted" whiteSpace="nowrap">
        <Box as="span" hideBelow="sm">
          Collection rows
        </Box>
        <Box as="span" hideFrom="sm">
          Collections
        </Box>
        <Box
          as="span"
          ml="1.5"
          color="fg.subtle"
          fontVariantNumeric="tabular-nums"
          hideBelow="sm"
        >
          {props.hiddenCount ? props.hiddenCount.toLocaleString() : ""}
        </Box>
      </Switch.Label>
    </Switch.Root>
  );
};
