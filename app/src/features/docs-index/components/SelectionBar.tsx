import { FolderInputIcon, TagsIcon, Trash2Icon, XIcon } from "lucide-solid";
import { Button } from "~/components/ui/button";
import { Box, HStack } from "styled-system/jsx";

/** Replaces the filter toolbar in place while notes are selected. */
export const SelectionBar = (props: {
  selectedCount: number;
  visibleCount: number;
  onSelectAll: () => void;
  onClear: () => void;
  onBulkMeta: () => void;
  onBulkPath: () => void;
  onDelete: () => Promise<void>;
}) => (
  <HStack gap="1" minW="0" flex="1" flexWrap="wrap">
    <Button
      size="xs"
      variant="plain"
      onClick={props.onClear}
      aria-label="Clear selection"
      title="Clear selection (Esc)"
      px="1.5"
    >
      <XIcon size={14} />
    </Button>
    <Box
      fontSize="sm"
      fontWeight="medium"
      fontVariantNumeric="tabular-nums"
      pr="2"
    >
      {props.selectedCount} selected
    </Box>
    <Button
      size="xs"
      variant="plain"
      disabled={props.selectedCount >= props.visibleCount}
      onClick={props.onSelectAll}
    >
      Select all {props.visibleCount}
    </Button>
    <Box flex="1" />
    <Button size="xs" variant="plain" onClick={props.onBulkMeta}>
      <TagsIcon size={14} />
      Edit meta
    </Button>
    <Button size="xs" variant="plain" onClick={props.onBulkPath}>
      <FolderInputIcon size={14} />
      Set path
    </Button>
    <Button
      size="xs"
      variant="plain"
      colorPalette="red"
      onClick={() => void props.onDelete()}
    >
      <Trash2Icon size={14} />
      Delete
    </Button>
  </HStack>
);
