import { ImagePlusIcon, Trash2Icon, XIcon } from "lucide-solid";
import { For, Show, createEffect, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { openImagePreview } from "~/components/editor/ui/imagePreviewService";
import { InPlaceEditableText } from "~/components/InPlaceEditableText";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { formatRelativeTime } from "~/features/docs-index/utils/time";
import type { ArchivedPageNoteItem } from "~/services/archive/archive.types";

const noteActionClass = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  w: "6",
  h: "6",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "fast",
  _hover: { bg: "gray.a4", color: "fg.default" },
});

function selectionQuote(context: Record<string, unknown> | null) {
  const text = context?.elementText ?? context?.selectionText;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

export type ArchiveNoteItemProps = {
  note: ArchivedPageNoteItem;
  onNoteCommit: (noteText: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onAddImage: (imageUrl: string) => Promise<void>;
  onDeleteImage: (index: number) => Promise<void>;
};

export const ArchiveNoteItem = (props: ArchiveNoteItemProps) => {
  const [noteText, setNoteText] = createSignal(props.note.noteText);
  const [noteError, setNoteError] = createSignal<string>();
  const [addingImage, setAddingImage] = createSignal(false);
  const [imageDraft, setImageDraft] = createSignal("");

  createEffect(() => setNoteText(props.note.noteText));

  const commitNoteText = async (next: string) => {
    setNoteText(next);
    setNoteError(undefined);
    if (!next.trim() && props.note.imageUrls.length === 0) {
      setNoteError("A note needs text or an image.");
      setNoteText(props.note.noteText);
      return;
    }
    try {
      await props.onNoteCommit(next);
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : "Could not save note.");
    }
  };

  const submitImage = async () => {
    const next = imageDraft().trim();
    if (!next) return;
    await props.onAddImage(next);
    setImageDraft("");
    setAddingImage(false);
  };

  return (
    <Stack gap="1.5" py="2.5" class="group" position="relative">
      <Show when={selectionQuote(props.note.sourceContext)}>
        {(quote) => (
          <Text
            fontSize="sm"
            color="fg.muted"
            fontStyle="italic"
            lineClamp="3"
            pl="2.5"
            boxShadow="inset 2px 0 0 var(--colors-gray-a5)"
          >
            {quote()}
          </Text>
        )}
      </Show>

      <InPlaceEditableText
        value={noteText()}
        placeholder="Add note text"
        onCommit={commitNoteText}
        activationMode="click"
        fillWidth
        wrapPreview
        allowEmpty
        minInputWidth="16rem"
      />

      <Show when={props.note.imageUrls.length > 0}>
        <HStack gap="2" flexWrap="wrap">
          <For each={props.note.imageUrls}>
            {(imageUrl, index) => (
              <Box position="relative" class="group/image">
                <button
                  type="button"
                  class={css({
                    display: "block",
                    w: "28",
                    h: "20",
                    borderRadius: "l2",
                    overflow: "hidden",
                    bg: "bg.subtle",
                    cursor: "zoom-in",
                    boxShadow: "inset 0 0 0 1px var(--colors-gray-a3)",
                  })}
                  onClick={() =>
                    openImagePreview({ src: imageUrl, alt: props.note.noteText || "Note image" })
                  }
                >
                  <img
                    src={imageUrl}
                    alt=""
                    loading="lazy"
                    style={{ width: "100%", height: "100%", "object-fit": "cover", display: "block" }}
                  />
                </button>
                <button
                  type="button"
                  aria-label="Remove image"
                  class={css({
                    position: "absolute",
                    top: "1",
                    right: "1",
                    display: "inline-flex",
                    p: "0.5",
                    borderRadius: "full",
                    bg: "bg.default",
                    color: "fg.muted",
                    cursor: "pointer",
                    opacity: 0,
                    boxShadow: "sm",
                    transitionProperty: "opacity",
                    transitionDuration: "fast",
                    _groupHover: { opacity: 1 },
                    _focusVisible: { opacity: 1 },
                  })}
                  onClick={() => void props.onDeleteImage(index())}
                >
                  <XIcon size={12} />
                </button>
              </Box>
            )}
          </For>
        </HStack>
      </Show>

      <Show when={addingImage()}>
        <HStack gap="2">
          <Input
            size="sm"
            fontFamily="mono"
            autofocus
            value={imageDraft()}
            placeholder="Image URL"
            onInput={(event) => setImageDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitImage();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setAddingImage(false);
              }
            }}
          />
          <Button type="button" size="sm" variant="outline" onClick={() => void submitImage()}>
            Add
          </Button>
        </HStack>
      </Show>

      <HStack gap="1" justify="space-between" minH="6">
        <Text fontSize="xs" color="fg.subtle">
          {formatRelativeTime(props.note.createdAt)}
        </Text>
        <Show when={noteError()}>
          {(message) => (
            <Text role="alert" fontSize="xs" color="fg.error" flex="1">
              {message()}
            </Text>
          )}
        </Show>
        <HStack
          gap="0.5"
          opacity="0"
          transitionProperty="opacity"
          transitionDuration="fast"
          _groupHover={{ opacity: 1 }}
          _groupFocusWithin={{ opacity: 1 }}
        >
          <button
            type="button"
            class={noteActionClass}
            aria-label="Attach image URL to note"
            title="Attach image URL"
            onClick={() => setAddingImage(true)}
          >
            <ImagePlusIcon size={14} />
          </button>
          <button
            type="button"
            class={noteActionClass}
            aria-label="Delete note"
            title="Delete note"
            onClick={() => void props.onDelete()}
          >
            <Trash2Icon size={14} />
          </button>
        </HStack>
      </HStack>
    </Stack>
  );
};
