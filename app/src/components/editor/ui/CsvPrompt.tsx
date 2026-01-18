import { createSignal } from "solid-js";
import { Button } from "~/components/ui/button";
import { Box, HStack, Stack } from "styled-system/jsx";
import { SimpleDialog } from "~/components/ui/simple-dialog";

export type Choice = "table" | "text" | "cancel";

export function useCsvPrompt() {
  const [open, setOpen] = createSignal(false);
  const [text, setText] = createSignal("");
  let resolver: ((c: Choice) => void) | undefined;

  const prompt = (t: string): Promise<Choice> =>
    new Promise((resolve) => {
      console.log("[csv] open prompt len:", t.length);
      setText(t);
      setOpen(true);
      resolver = (c) => {
        console.log("[csv] prompt resolved:", c);
        setOpen(false);
        resolve(c);
      };
    });

  const view = (
    <SimpleDialog
      open={open()}
      onClose={() => resolver?.("cancel")}
      title="Paste detected as CSV/TSV"
      description="Choose how to insert the content:"
      maxW="720px"
    >
      <Stack gap="3">
        <Box
          borderWidth="1px"
          borderColor="gray.outline.border"
          bg="gray.surface.bg"
          borderRadius="l2"
          p="2"
          maxH="10rem"
          overflow="auto"
          fontSize="xs"
          fontFamily="mono"
          whiteSpace="pre"
        >
          {text().slice(0, 500)}
          {text().length > 500 ? "…" : ""}
        </Box>
        <HStack gap="2" justifyContent="flex-end">
          <Button
            size="sm"
            variant="outline"
            colorPalette="gray"
            onClick={() => resolver?.("text")}
          >
            Paste contents directly
          </Button>
          <Button
            size="sm"
            variant="outline"
            colorPalette="gray"
            onClick={() => resolver?.("table")}
          >
            Paste as table
          </Button>
        </HStack>
      </Stack>
    </SimpleDialog>
  );

  return { prompt, view };
}
