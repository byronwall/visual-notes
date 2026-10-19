import { ImagePlusIcon } from "lucide-solid";
import { Show, createSignal } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Input } from "~/components/ui/input";
import { Kbd } from "~/components/ui/kbd";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";

export type NoteDraft = { text: string; imageUrl: string; error?: string };

/** Grows the textarea with its content so the whole note stays visible. */
export function autosize(element: HTMLTextAreaElement) {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight + 2}px`;
}

export const ArchiveNoteComposer = (props: {
  draft: NoteDraft;
  busy: boolean;
  onDraft: (patch: Partial<NoteDraft>) => void;
  onSubmit: () => void;
  textareaRef?: (element: HTMLTextAreaElement) => void;
}) => {
  const [showImage, setShowImage] = createSignal(false);
  const canSubmit = () => !props.busy && Boolean(props.draft.text.trim() || props.draft.imageUrl.trim());

  return (
    <Stack
      gap="2"
      p="2"
      borderRadius="l3"
      bg="bg.subtle"
      transitionProperty="box-shadow"
      transitionDuration="fast"
      _focusWithin={{ boxShadow: "inset 0 0 0 1px var(--colors-gray-a7)" }}
    >
      <Textarea
        ref={(element) => {
          props.textareaRef?.(element);
          queueMicrotask(() => autosize(element));
        }}
        variant="flushed"
        value={props.draft.text}
        placeholder="Add a note…"
        aria-label="New note"
        rows={2}
        resize="none"
        minH="0"
        px="1.5"
        borderBottomWidth="0"
        bg="transparent"
        _focus={{ boxShadow: "none" }}
        onInput={(event) => {
          autosize(event.currentTarget);
          props.onDraft({ text: event.currentTarget.value, error: undefined });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            if (canSubmit()) props.onSubmit();
          }
        }}
      />
      <Show when={showImage() || props.draft.imageUrl}>
        <Input
          size="sm"
          value={props.draft.imageUrl}
          placeholder="Image URL"
          aria-label="Image URL"
          fontFamily="mono"
          autofocus
          onInput={(event) => props.onDraft({ imageUrl: event.currentTarget.value, error: undefined })}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (canSubmit()) props.onSubmit();
            }
          }}
        />
      </Show>
      <HStack justify="space-between" gap="2">
        <HStack gap="2" minW="0">
          <IconButton
            type="button"
            size="xs"
            variant="plain"
            aria-label="Attach image URL"
            title="Attach image URL"
            aria-pressed={showImage()}
            onClick={() => setShowImage((value) => !value)}
          >
            <ImagePlusIcon size={15} />
          </IconButton>
          <Show when={props.draft.error}>
            {(message) => (
              <Text role="alert" fontSize="xs" color="fg.error">
                {message()}
              </Text>
            )}
          </Show>
        </HStack>
        <HStack gap="2">
          <Box hideBelow="sm" color="fg.subtle" fontSize="xs" display="flex" gap="1" alignItems="center">
            <Kbd size="sm">⌘</Kbd>
            <Kbd size="sm">↵</Kbd>
          </Box>
          <Button type="button" size="xs" disabled={!canSubmit()} loading={props.busy} onClick={props.onSubmit}>
            Add note
          </Button>
        </HStack>
      </HStack>
    </Stack>
  );
};
