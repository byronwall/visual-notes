import type { Editor } from "@tiptap/core";
import {
  CheckIcon,
  ExpandIcon,
  GripIcon,
  GripHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-solid";
import { For, Show, createMemo, createSignal } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import TiptapEditor from "~/components/TiptapEditor";
import { documentContentStyles } from "~/components/document-content-styles";
import { openImagePreview } from "~/components/editor/ui/imagePreviewService";
import { Button } from "~/components/ui/button";
import type { ArchivedCanvasNodeItem } from "~/services/archive/archive.types";

type Props = {
  item: ArchivedCanvasNodeItem;
  isActive: boolean;
  isDragging: boolean;
  isEditing: boolean;
  isResizing: boolean;
  cardRef?: (element: HTMLDivElement | undefined) => void;
  onActivate: () => void;
  onDragStart: (event: PointerEvent) => void;
  onResizeStart: (
    event: PointerEvent,
    direction: "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw",
  ) => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSaveNote: (html: string) => Promise<void>;
  onDelete: () => void;
};

export const ArchiveCanvasFreeformCard = (props: Props) => {
  const [editor, setEditor] = createSignal<Editor>();
  const [saving, setSaving] = createSignal(false);
  const [hovered, setHovered] = createSignal(false);
  const [focused, setFocused] = createSignal(false);

  const isNote = createMemo(() => props.item.kind === "note");
  const chromeVisible = createMemo(() =>
    hovered() || focused() || props.isDragging || props.isEditing || props.isResizing,
  );
  const resizeHandles = [
    {
      direction: "n" as const,
      label: "Resize from top edge",
      cursor: "ns-resize",
      style: { top: "-8px", left: "22px", right: "22px", height: "16px", width: "auto" },
      indicatorStyle: { width: "48px", height: "4px" },
    },
    {
      direction: "e" as const,
      label: "Resize from right edge",
      cursor: "ew-resize",
      style: { top: "22px", right: "-8px", bottom: "22px", width: "16px", height: "auto" },
      indicatorStyle: { width: "4px", height: "48px" },
    },
    {
      direction: "s" as const,
      label: "Resize from bottom edge",
      cursor: "ns-resize",
      style: { right: "22px", bottom: "-8px", left: "22px", height: "16px", width: "auto" },
      indicatorStyle: { width: "48px", height: "4px" },
    },
    {
      direction: "w" as const,
      label: "Resize from left edge",
      cursor: "ew-resize",
      style: { top: "22px", bottom: "22px", left: "-8px", width: "16px", height: "auto" },
      indicatorStyle: { width: "4px", height: "48px" },
    },
    {
      direction: "nw" as const,
      label: "Resize from top left corner",
      cursor: "nwse-resize",
      style: { top: "-8px", left: "-8px", width: "16px", height: "16px" },
      indicatorStyle: { width: "10px", height: "10px" },
    },
    {
      direction: "ne" as const,
      label: "Resize from top right corner",
      cursor: "nesw-resize",
      style: { top: "-8px", right: "-8px", width: "16px", height: "16px" },
      indicatorStyle: { width: "10px", height: "10px" },
    },
    {
      direction: "se" as const,
      label: "Resize from bottom right corner",
      cursor: "nwse-resize",
      style: { right: "-8px", bottom: "-8px", width: "16px", height: "16px" },
      indicatorStyle: { width: "10px", height: "10px" },
    },
    {
      direction: "sw" as const,
      label: "Resize from bottom left corner",
      cursor: "nesw-resize",
      style: { bottom: "-8px", left: "-8px", width: "16px", height: "16px" },
      indicatorStyle: { width: "10px", height: "10px" },
    },
  ];

  const saveNote = async () => {
    const current = editor();
    if (!current || saving()) return;
    setSaving(true);
    try {
      await props.onSaveNote(current.getHTML());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      position="relative"
      minW="0"
      minH="0"
      borderRadius="20px"
      borderWidth="1px"
      borderColor={chromeVisible() ? "border.accent" : "border"}
      bg="bg.default"
      boxShadow={props.isDragging || props.isResizing ? "lg" : props.isActive ? "md" : "sm"}
      overflow="visible"
      transitionDuration="normal"
      transitionProperty="box-shadow, border-color"
      style={{
        width: `${props.item.canvasWidth}px`,
        height: `${props.item.canvasHeight}px`,
        "touch-action": "none",
      }}
      ref={props.cardRef}
      onPointerEnter={() => {
        setHovered(true);
        props.onActivate();
      }}
      onMouseEnter={() => {
        setHovered(true);
        props.onActivate();
      }}
      onPointerLeave={() => setHovered(false)}
      onMouseLeave={() => setHovered(false)}
      onFocusIn={() => {
        setFocused(true);
        props.onActivate();
      }}
      onFocusOut={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
        setFocused(false);
      }}
    >
      <HStack
        position="absolute"
        top="0"
        left="4"
        zIndex="3"
        gap="1"
        p="1"
        borderRadius="full"
        borderWidth="1px"
        borderColor="border"
        bg="bg.default"
        boxShadow="sm"
        opacity={chromeVisible() ? 1 : 0}
        pointerEvents={chromeVisible() ? "auto" : "none"}
        transitionDuration="normal"
        transitionProperty="opacity"
        style={{ top: "-34px" }}
      >
        <Button
          type="button"
          size="xs"
          variant="plain"
          aria-label={isNote() ? "Move free text node" : "Move image node"}
          cursor={props.isDragging ? "grabbing" : "grab"}
          onPointerDown={(event) => {
            event.stopPropagation();
            props.onActivate();
            props.onDragStart(event);
          }}
        >
          <GripHorizontalIcon size={14} />
        </Button>
      </HStack>

      <HStack
        position="absolute"
        top="0"
        right="4"
        zIndex="3"
        gap="1"
        p="1"
        borderRadius="full"
        borderWidth="1px"
        borderColor="border"
        bg="bg.default"
        boxShadow="sm"
        opacity={chromeVisible() ? 1 : 0}
        pointerEvents={chromeVisible() ? "auto" : "none"}
        transitionDuration="normal"
        transitionProperty="opacity"
        style={{ top: "-34px" }}
      >
        <Show
          when={props.isEditing}
          fallback={
            <>
              <Show when={isNote()}>
                <Button
                  type="button"
                  size="xs"
                  variant="plain"
                  aria-label="Edit free text"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onStartEditing();
                  }}
                >
                  <PencilIcon size={14} />
                </Button>
              </Show>
              <Show when={!isNote()}>
                <Button
                  type="button"
                  size="xs"
                  variant="plain"
                  aria-label="Open image"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!props.item.imageUrl) return;
                    openImagePreview({
                      src: props.item.imageUrl,
                      title: "Canvas image",
                    });
                  }}
                >
                  <ExpandIcon size={14} />
                </Button>
              </Show>
              <Button
                type="button"
                size="xs"
                variant="plain"
                colorPalette="red"
                aria-label="Delete canvas item"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  props.onDelete();
                }}
              >
                <Trash2Icon size={14} />
              </Button>
            </>
          }
        >
          <Button
            type="button"
            size="xs"
            variant="plain"
            aria-label="Cancel editing free text"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              props.onCancelEditing();
            }}
          >
            <XIcon size={14} />
          </Button>
          <Button
            type="button"
            size="xs"
            variant="solid"
            aria-label="Save free text"
            disabled={saving()}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              void saveNote();
            }}
          >
            <CheckIcon size={14} />
          </Button>
        </Show>
      </HStack>

      <Box
        h="full"
        borderRadius="inherit"
        overflow="hidden"
        bg={isNote() ? "bg.default" : "bg.subtle"}
      >
        <Show
          when={isNote()}
          fallback={
            <Button
              type="button"
              variant="plain"
              p="0"
              h="full"
              w="full"
              borderRadius="0"
              bg="transparent"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                if (!props.item.imageUrl) return;
                openImagePreview({
                  src: props.item.imageUrl,
                  title: "Canvas image",
                });
              }}
            >
              <Show when={props.item.imageUrl}>
                {(src) => (
                  <img
                    src={src()}
                    alt="Canvas image"
                    style={{
                      width: "100%",
                      height: "100%",
                      "object-fit": "contain",
                      display: "block",
                    }}
                  />
                )}
              </Show>
            </Button>
          }
        >
          <Show
            when={props.isEditing}
            fallback={
              <Box
                h="full"
                w="full"
                minW="0"
                p="4"
                overflow="hidden"
                css={{
                  ...documentContentStyles,
                  "& .vn-doc-content": {
                    height: "100%",
                    width: "100%",
                    maxWidth: "100%",
                    minWidth: "0",
                    overflow: "hidden",
                    whiteSpace: "normal",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  },
                  "& .vn-doc-content > *": {
                    maxWidth: "100%",
                    minWidth: "0",
                  },
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  props.onActivate();
                }}
                onDblClick={() => props.onStartEditing()}
              >
                <Box
                  class="vn-doc-content"
                  color="fg.default"
                  fontSize="sm"
                  innerHTML={props.item.contentHtml || "<p></p>"}
                />
              </Box>
            }
          >
            <Box
              h="full"
              w="full"
              minW="0"
              overflow="hidden"
              p="4"
              css={{
                ...documentContentStyles,
                "& .ProseMirror": {
                  height: "100%",
                  width: "100%",
                  maxWidth: "100%",
                  minWidth: "0",
                  minHeight: "100%",
                  overflow: "auto",
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                },
                "& .ProseMirror > *": {
                  maxWidth: "100%",
                  minWidth: "0",
                },
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onDblClick={(event) => event.stopPropagation()}
            >
              <TiptapEditor
                initialHTML={props.item.contentHtml || "<p></p>"}
                onEditor={setEditor}
                showToolbar={false}
                showAiPromptsMenu={false}
                fillHeight
                minEditorHeight="100%"
                borderless
              />
            </Box>
          </Show>
        </Show>
      </Box>

      <For each={resizeHandles}>
        {(handle) => (
          <Button
            type="button"
            position="absolute"
            zIndex="4"
            p="0"
            minW="0"
            minH="0"
            borderRadius="full"
            borderWidth="0"
            bg="transparent"
            cursor={handle.cursor}
            aria-label={`${isNote() ? "Resize free text node" : "Resize image node"} ${handle.label}`}
            opacity={chromeVisible() ? 1 : handle.direction === "se" ? 0.94 : 0}
            pointerEvents="auto"
            transitionDuration="normal"
            transitionProperty="opacity"
            style={{
              ...handle.style,
              cursor: handle.cursor,
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              props.onActivate();
              props.onResizeStart(event, handle.direction);
            }}
          >
            <Box
              borderRadius="full"
              borderWidth={chromeVisible() ? "1px" : handle.direction === "se" ? "1px" : "0"}
              borderColor={chromeVisible() ? "border.accent" : "border"}
              bg={chromeVisible() || handle.direction === "se" ? "bg.default" : "transparent"}
              boxShadow={chromeVisible() && handle.direction.includes("s") ? "sm" : undefined}
              display="flex"
              alignItems="center"
              justifyContent="center"
              style={{
                ...handle.indicatorStyle,
                cursor: handle.cursor,
              }}
            >
              <Show when={handle.direction === "se"}>
                <GripIcon size={12} />
              </Show>
            </Box>
          </Button>
        )}
      </For>
    </Box>
  );
};
