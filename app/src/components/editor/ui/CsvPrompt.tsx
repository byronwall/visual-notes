import { createSignal } from "solid-js";
import { Button } from "~/components/ui/button";
import { Box, HStack, Stack } from "styled-system/jsx";
import * as Dialog from "~/components/ui/dialog";
import { css } from "styled-system/css";
import { XIcon } from "lucide-solid";

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
    <Dialog.Root
      open={open()}
      onOpenChange={(details: { open?: boolean }) => {
        if (details?.open === false) resolver?.("cancel");
      }}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          class={css({
            maxW: "720px",
            "--dialog-base-margin": "24px",
          })}
        >
          <Dialog.Header>
            <Dialog.Title>Paste detected as CSV/TSV</Dialog.Title>
            <Dialog.Description>Choose how to insert the content:</Dialog.Description>
          </Dialog.Header>

          <Dialog.CloseTrigger
            aria-label="Close dialog"
            onClick={() => resolver?.("cancel")}
          >
            <XIcon />
          </Dialog.CloseTrigger>

          <Dialog.Body>
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
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );

  return { prompt, view };
}

