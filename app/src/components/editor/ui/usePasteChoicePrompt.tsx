import { createSignal, type JSX } from "solid-js";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Box, HStack, Stack } from "styled-system/jsx";

type PasteChoiceOption<TChoice extends string> = {
  label: string;
  value: TChoice;
};

type UsePasteChoicePromptProps<TChoice extends string> = {
  cancelChoice: TChoice;
  logPrefix: string;
  title: string;
  description: string;
  options: [PasteChoiceOption<TChoice>, PasteChoiceOption<TChoice>];
  previewLimit?: number;
  maxW?: string;
};

export function usePasteChoicePrompt<TChoice extends string>(
  props: UsePasteChoicePromptProps<TChoice>
): {
  prompt: (text: string) => Promise<TChoice>;
  view: JSX.Element;
} {
  const [open, setOpen] = createSignal(false);
  const [text, setText] = createSignal("");
  let resolver: ((choice: TChoice) => void) | undefined;

  const limit = () => props.previewLimit ?? 500;

  const prompt = (input: string): Promise<TChoice> =>
    new Promise((resolve) => {
      setText(input);
      setOpen(true);
      resolver = (choice) => {
        setOpen(false);
        resolve(choice);
      };
    });

  const view = (
    <SimpleDialog
      open={open()}
      onClose={() => resolver?.(props.cancelChoice)}
      title={props.title}
      description={props.description}
      maxW={props.maxW ?? "720px"}
      footer={
        <HStack gap="2" justifyContent="flex-end" w="full">
          <Button
            size="sm"
            variant="outline"
            colorPalette="gray"
            onClick={() => resolver?.(props.options[0].value)}
          >
            {props.options[0].label}
          </Button>
          <Button
            size="sm"
            variant="outline"
            colorPalette="gray"
            onClick={() => resolver?.(props.options[1].value)}
          >
            {props.options[1].label}
          </Button>
        </HStack>
      }
    >
      <Stack gap="3" w="full" maxW="100%" minW="0" overflowX="hidden">
        <Box
          borderWidth="1px"
          borderColor="gray.outline.border"
          bg="gray.surface.bg"
          borderRadius="l2"
          p="0"
          w="full"
          minW="0"
          maxW="100%"
          overflow="hidden"
        >
          <Box
            p="2"
            maxH="10rem"
            overflowX="auto"
            overflowY="auto"
            w="full"
            maxW="100%"
            minW="0"
          >
            <Box
              as="pre"
              m="0"
              display="inline-block"
              w="max-content"
              maxW="none"
              fontSize="xs"
              fontFamily="mono"
              whiteSpace="pre"
            >
              {text().slice(0, limit())}
              {text().length > limit() ? "…" : ""}
            </Box>
          </Box>
        </Box>
      </Stack>
    </SimpleDialog>
  );

  return { prompt, view };
}
