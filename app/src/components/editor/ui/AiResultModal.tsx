import { createSignal } from "solid-js";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Box, HStack, Stack } from "styled-system/jsx";
import { SimpleDialog } from "~/components/ui/simple-dialog";

export type AiResultOpenArgs = {
  selectionText: string;
  outputHtml: string;
};

export function useAiResultModal() {
  const [open, setOpen] = createSignal(false);
  const [selectionText, setSelectionText] = createSignal<string>("");
  const [outputHtml, setOutputHtml] = createSignal<string>("");

  let resolver: (() => void) | undefined;

  const openModal = (args: AiResultOpenArgs) =>
    new Promise<void>((resolve) => {
      console.log("[ai-result-modal] open");
      setSelectionText(args.selectionText || "");
      setOutputHtml(args.outputHtml || "");
      setOpen(true);
      resolver = () => {
        setOpen(false);
        resolve();
      };
    });

  const onClose = () => resolver?.();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log("[ai-result-modal] copied");
    } catch (e) {
      console.log("[ai-result-modal] copy failed", (e as Error)?.message);
    }
  };

  const onCopySelection = () => copyToClipboard(selectionText());

  const onCopyOutputText = () => {
    // Convert HTML to plain text for copying
    const div = document.createElement("div");
    div.innerHTML = outputHtml();
    copyToClipboard(div.innerText);
  };

  const onCopyOutputHtml = () => copyToClipboard(outputHtml());

  const view = (
    <SimpleDialog
      open={open()}
      onClose={onClose}
      title="AI Output"
      maxW="900px"
      footer={
        <HStack justifyContent="flex-end" w="full">
          <Button
            size="sm"
            variant="outline"
            colorPalette="gray"
            onClick={onClose}
          >
            Close
          </Button>
        </HStack>
      }
    >
      <Stack gap="3">
        <Stack gap="2">
          <Text fontSize="xs" color="fg.muted">
            Selection (used as input)
          </Text>
          <Box
            as="pre"
            borderWidth="1px"
            borderColor="gray.outline.border"
            borderRadius="l2"
            p="2"
            fontSize="xs"
            maxH="10rem"
            overflow="auto"
            whiteSpace="pre-wrap"
          >
            {selectionText()}
          </Box>
          <HStack justifyContent="flex-end">
            <Button
              size="xs"
              variant="outline"
              colorPalette="gray"
              onClick={onCopySelection}
            >
              Copy selection
            </Button>
          </HStack>
        </Stack>

        <Stack gap="2">
          <Text fontSize="xs" color="fg.muted">
            Output
          </Text>
          <Box
            class="prose"
            borderWidth="1px"
            borderColor="gray.outline.border"
            borderRadius="l2"
            p="2"
            maxH="20rem"
            overflow="auto"
            innerHTML={outputHtml()}
          />
          <HStack gap="2" justifyContent="flex-end">
            <Button
              size="xs"
              variant="outline"
              colorPalette="gray"
              onClick={onCopyOutputText}
            >
              Copy output (text)
            </Button>
            <Button
              size="xs"
              variant="outline"
              colorPalette="gray"
              onClick={onCopyOutputHtml}
            >
              Copy output (HTML)
            </Button>
          </HStack>
        </Stack>
      </Stack>
    </SimpleDialog>
  );

  return { open: openModal, view };
}
