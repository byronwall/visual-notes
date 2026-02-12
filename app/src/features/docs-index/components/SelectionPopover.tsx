import { createSignal } from "solid-js";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Box, HStack, Stack } from "styled-system/jsx";
import { ListChecksIcon } from "lucide-solid";
import { PanelPopover } from "~/components/ui/panel-popover";

export const SelectionPopover = (props: {
  visibleCount: number;
  selectedCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => Promise<void>;
  onBulkMeta: () => void;
  onBulkPath: () => void;
}) => {
  const [open, setOpen] = createSignal(false);

  return (
    <PanelPopover
      open={open()}
      onClose={() => setOpen(false)}
      placement="bottom-end"
      offset={8}
      width="23rem"
      title="Selection"
      description="Bulk actions for currently visible notes."
      anchor={
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          <HStack gap="1.5" alignItems="center">
            <ListChecksIcon size={16} />
            <Box as="span">Selection</Box>
          </HStack>
        </Button>
      }
    >
      <Stack gap="0.75rem">
        <HStack gap="2" alignItems="center">
          <Box
            borderWidth="1px"
            borderColor="border"
            borderRadius="full"
            px="2.5"
            py="1"
            bg="bg.subtle"
          >
            <Text fontSize="xs" color="fg.muted">
              Selected: {props.selectedCount}
            </Text>
          </Box>
          <Box
            borderWidth="1px"
            borderColor="border"
            borderRadius="full"
            px="2.5"
            py="1"
            bg="bg.subtle"
          >
            <Text fontSize="xs" color="fg.muted">
              Visible: {props.visibleCount}
            </Text>
          </Box>
        </HStack>
        <HStack gap="2" flexWrap="wrap">
          <Button
            size="sm"
            variant="outline"
            disabled={props.visibleCount === 0}
            onClick={props.onSelectAll}
          >
            Select All ({props.visibleCount})
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={props.selectedCount === 0}
            onClick={props.onClearSelection}
          >
            Clear
          </Button>
        </HStack>
        <HStack gap="2" flexWrap="wrap">
          <Button
            size="sm"
            colorPalette="red"
            disabled={props.selectedCount === 0}
            onClick={async () => {
              await props.onDeleteSelected();
              setOpen(false);
            }}
          >
            Delete ({props.selectedCount})
          </Button>
          <Button
            size="sm"
            variant="subtle"
            disabled={props.selectedCount === 0}
            onClick={() => {
              props.onBulkMeta();
              setOpen(false);
            }}
          >
            Edit Meta
          </Button>
          <Button
            size="sm"
            variant="subtle"
            disabled={props.selectedCount === 0}
            onClick={() => {
              props.onBulkPath();
              setOpen(false);
            }}
          >
            Set Path
          </Button>
        </HStack>
      </Stack>
    </PanelPopover>
  );
};
