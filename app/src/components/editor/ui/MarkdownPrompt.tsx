import { createSignal } from "solid-js";
import { Button } from "~/components/ui/button";
import { Box, HStack, Stack } from "styled-system/jsx";
import { SimpleDialog } from "~/components/ui/simple-dialog";

export type MdChoice = "formatted" | "text" | "cancel";

export function useMarkdownPrompt() {
  const [open, setOpen] = createSignal(false);
  const [text, setText] = createSignal("");
  let resolver: ((c: MdChoice) => void) | undefined;

  const prompt = (t: string): Promise<MdChoice> =>
    new Promise((resolve) => {
      console.log("[markdown] open prompt len:", t.length);
      setText(t);
      setOpen(true);
      resolver = (c) => {
        console.log("[markdown] prompt resolved:", c);
        setOpen(false);
        resolve(c);
      };
    });

  const view = (
    <SimpleDialog
      open={open()}
      onClose={() => resolver?.("cancel")}
      title="Paste detected as Markdown"
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
            Paste as raw text
          </Button>
          <Button
            size="sm"
            variant="outline"
            colorPalette="gray"
            onClick={() => resolver?.("formatted")}
          >
            Paste with formatting
          </Button>
        </HStack>
      </Stack>
    </SimpleDialog>
  );

  return { prompt, view };
}
