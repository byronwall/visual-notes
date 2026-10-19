import { MessageSquareTextIcon, PanelRightOpenIcon, TextQuoteIcon } from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { ArchiveFavicon } from "~/components/archive/ArchiveFavicon";
import { openImagePreview } from "~/components/editor/ui/imagePreviewService";
import { Button } from "~/components/ui/button";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import type {
  ArchivedPageCanvasCardMode,
  ArchivedPageCanvasItem,
} from "~/services/archive/archive.types";

type Props = {
  item: ArchivedPageCanvasItem;
  isActive: boolean;
  isDragging: boolean;
  cardRef?: (element: HTMLDivElement | undefined) => void;
  onActivate: () => void;
  onDragStart: (event: PointerEvent) => void;
  onModeChange: (mode: ArchivedPageCanvasCardMode) => void;
  onOpenDetails: () => void;
};

function truncateUrl(url: string, maxLength = 46) {
  if (url.length <= maxLength) return url;
  return `${url.slice(0, maxLength - 1)}…`;
}

const MODE_OPTIONS: Array<{
  label: string;
  value: ArchivedPageCanvasCardMode;
  title: string;
}> = [
  { label: "C", value: "compact", title: "Compact: title and link" },
  { label: "S", value: "summary", title: "Summary: description and notes" },
  { label: "R", value: "rich", title: "Rich: longer text and images" },
];

const SourceLine = (props: { kind: "meta" | "note"; text: string; lines: number }) => (
  <HStack alignItems="flex-start" gap="2" title={props.kind === "note" ? "Your note" : "Page description"}>
    <Box pt="0.5" color={props.kind === "note" ? "green.10" : "fg.subtle"} flexShrink="0" display="flex">
      {props.kind === "note" ? <MessageSquareTextIcon size={13} /> : <TextQuoteIcon size={13} />}
    </Box>
    <Text
      fontSize="sm"
      color={props.kind === "note" ? "fg.default" : "fg.muted"}
      lineHeight="snug"
      lineClamp={props.lines}
    >
      {props.text}
    </Text>
  </HStack>
);

export const ArchiveCanvasCard = (props: Props) => {
  const [showChrome, setShowChrome] = createSignal(false);

  return (
    <Box
      position="relative"
      w="320px"
      maxW="320px"
      borderRadius="l3"
      borderWidth="1px"
      borderColor={props.isDragging || props.isActive ? "gray.a7" : "border"}
      bg="bg.default"
      boxShadow={props.isDragging ? "lg" : props.isActive ? "md" : "sm"}
      overflow="visible"
      transitionDuration="normal"
      transitionProperty="box-shadow, border-color, transform"
      cursor={props.isDragging ? "grabbing" : "pointer"}
      userSelect="none"
      style={{
        "touch-action": "none",
      }}
      onPointerDown={(event) => {
        const target = event.target;
        if (target instanceof Element && target.closest("button, a, input, textarea, [data-no-drag]")) return;
        props.onActivate();
        props.onDragStart(event);
      }}
      onPointerEnter={() => {
        setShowChrome(true);
        props.onActivate();
      }}
      onPointerLeave={() => setShowChrome(false)}
      onFocusIn={() => {
        setShowChrome(true);
        props.onActivate();
      }}
      onFocusOut={() => setShowChrome(false)}
      ref={props.cardRef}
    >
      <HStack
        position="absolute"
        top="-4"
        right="3"
        zIndex="3"
        gap="0.5"
        p="0.5"
        borderRadius="full"
        borderWidth="1px"
        borderColor="border"
        bg="bg.default"
        boxShadow="sm"
        opacity={showChrome() ? 1 : 0}
        pointerEvents={showChrome() ? "auto" : "none"}
        transitionDuration="normal"
        transitionProperty="opacity"
      >
        <For each={MODE_OPTIONS}>
          {(option) => (
            <Button
              type="button"
              size="xs"
              variant={props.item.canvasCardMode === option.value ? "solid" : "plain"}
              aria-label={`Show ${option.value} card`}
              title={option.title}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                props.onActivate();
                props.onModeChange(option.value);
              }}
            >
              {option.label}
            </Button>
          )}
        </For>
        <Button
          type="button"
          variant="plain"
          size="xs"
          aria-label={`Open details for ${props.item.title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            props.onActivate();
            props.onOpenDetails();
          }}
        >
          <PanelRightOpenIcon size={14} />
        </Button>
      </HStack>

      <Stack gap="2.5" px="4" py="3.5" overflow="hidden" borderRadius="inherit">
        <HStack gap="2.5" minW="0" alignItems="flex-start">
          <Box pt="0.5">
            <ArchiveFavicon src={props.item.faviconUrl} title={props.item.title} size="18px" />
          </Box>
          <Stack gap="0.5" minW="0">
            <Text fontSize="sm" fontWeight="semibold" lineHeight="snug" lineClamp="2">
              {props.item.title}
            </Text>
            <Link
              href={props.item.originalUrl}
              target="_blank"
              rel="noreferrer"
              fontSize="xs"
              fontFamily="mono"
              color="fg.muted"
              textDecoration="none"
              whiteSpace="nowrap"
              overflow="hidden"
              textOverflow="ellipsis"
              maxW="full"
              display="block"
              _hover={{ color: "colorPalette.default" }}
              title={props.item.originalUrl}
              onClick={(event) => event.stopPropagation()}
            >
              {props.item.siteHostname?.replace(/^www\./, "") || truncateUrl(props.item.originalUrl)}
            </Link>
          </Stack>
        </HStack>

        <Show when={props.item.canvasCardMode !== "compact"}>
          <Stack gap="1.5">
            <Show when={props.item.metaDescription || (props.item.noteSnippets.length === 0 && props.item.description)}>
              {(description) => (
                <SourceLine
                  kind={props.item.metaDescription ? "meta" : props.item.descriptionSource ?? "meta"}
                  text={description()}
                  lines={props.item.canvasCardMode === "rich" ? 4 : 2}
                />
              )}
            </Show>
            <For each={props.item.noteSnippets}>
              {(noteText) => (
                <SourceLine kind="note" text={noteText} lines={props.item.canvasCardMode === "rich" ? 3 : 2} />
              )}
            </For>
          </Stack>
        </Show>

          <Show when={props.item.canvasCardMode === "rich" && props.item.preferredImages.length > 0}>
            <Box display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="2">
              <For each={props.item.preferredImages}>
                {(src) => (
                  <Button
                    type="button"
                    variant="plain"
                    p="0"
                    h="auto"
                    w="auto"
                    borderRadius="l2"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      openImagePreview({
                        src,
                        alt: props.item.title,
                        title: props.item.title,
                      });
                    }}
                  >
                    <Box
                      borderRadius="l2"
                      overflow="hidden"
                      borderWidth="1px"
                      borderColor="border"
                      bg="bg.subtle"
                      aspectRatio="4 / 3"
                    >
                      <img
                        src={src}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          "object-fit": "cover",
                          display: "block",
                        }}
                      />
                    </Box>
                  </Button>
                )}
              </For>
            </Box>
          </Show>
      </Stack>
    </Box>
  );
};
