import { Show, createSignal, type VoidComponent } from "solid-js";
import Modal from "~/components/Modal";
import { PathEditor } from "~/components/PathEditor";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Box, HStack, Stack } from "styled-system/jsx";

export const BulkPathModal: VoidComponent<{
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  onApply: (path: string) => Promise<void>;
}> = (props) => {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [draftPath, setDraftPath] = createSignal("");

  const handleApply = async () => {
    if (busy()) return;
    setBusy(true);
    setError(undefined);
    try {
      await props.onApply(draftPath());
      props.onClose();
      setDraftPath("");
    } catch (e) {
      setError((e as Error).message || "Failed to apply path");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy()) return;
    setDraftPath("");
    props.onClose();
  };

  return (
    <Modal open={props.open} onClose={handleClose}>
      <Stack p="1rem" gap="0.75rem">
        <HStack justifyContent="space-between" alignItems="center">
          <Text fontSize="sm" fontWeight="semibold">
            Bulk set path
          </Text>
          <Text fontSize="xs" color="black.a7">
            Selected: {props.selectedCount}
          </Text>
        </HStack>

        <Show when={!!error()}>
          <Text fontSize="xs" color="red.11">
            {error()}
          </Text>
        </Show>

        <Box>
          <Text fontSize="xs" color="black.a7" mb="0.25rem">
            Path
          </Text>
          <PathEditor onChange={(p) => setDraftPath(p)} />
        </Box>

        <HStack justifyContent="flex-end" gap="0.5rem">
          <Button size="sm" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            colorPalette="grass"
            disabled={busy()}
            onClick={handleApply}
          >
            Apply to {props.selectedCount} items
          </Button>
        </HStack>
      </Stack>
    </Modal>
  );
};
