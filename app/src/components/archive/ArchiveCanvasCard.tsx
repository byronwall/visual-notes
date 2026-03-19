import { PanelRightOpenIcon } from "lucide-solid";
import { For, Show, createSignal, type JSX } from "solid-js";
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
}> = [
  { label: "C", value: "compact" },
  { label: "S", value: "summary" },
  { label: "R", value: "rich" },
];

const SOURCE_STYLES = {
  meta: {
    label: "OG",
    colorPalette: "blue",
  },
  note: {
    label: "Note",
    colorPalette: "green",
  },
} as const;

export const ArchiveCanvasCard = (props: Props) => {
  const [showChrome, setShowChrome] = createSignal(false);

  return (
    <Box
      position="relative"
      w="320px"
      maxW="320px"
      borderRadius="l3"
      borderWidth="1px"
      borderColor={props.isDragging || props.isActive ? "border.accent" : "border"}
      bg="bg.default"
      boxShadow={props.isDragging ? "lg" : props.isActive ? "md" : "sm"}
      overflow="visible"
      transitionDuration="normal"
      transitionProperty="box-shadow, border-color, transform"
      style={{
        "touch-action": "none",
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
        top="0"
        right="3"
        gap="1"
        p="1"
        borderRadius="full"
        borderWidth="1px"
        borderColor="border"
        bg="bg.default"
        boxShadow="sm"
        opacity={showChrome() ? 1 : 0}
        pointerEvents={showChrome() ? "auto" : "none"}
        transitionDuration="normal"
        transitionProperty="opacity, transform"
        style={{
          transform: showChrome()
            ? "translateY(calc(-100% + 1px))"
            : "translateY(calc(-100% - 3px))",
        }}
      >
        <For each={MODE_OPTIONS}>
          {(option) => (
            <Button
              type="button"
              size="xs"
              variant={props.item.canvasCardMode === option.value ? "solid" : "plain"}
              aria-label={`Show ${option.value} card`}
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
      </HStack>

      <Stack gap="0" overflow="hidden" borderRadius="inherit">
        <HStack
          justify="space-between"
          gap="3"
          px="3"
          py="2.5"
          bg="bg.subtle"
          borderBottomWidth="1px"
          borderColor="border"
          cursor={props.isDragging ? "grabbing" : "grab"}
          transitionDuration="normal"
          transitionProperty="background-color, box-shadow"
          _hover={{ bg: "bg.muted" }}
          onPointerDown={(event) => {
            props.onActivate();
            props.onDragStart(event);
          }}
        >
          <HStack gap="2.5" minW="0" flex="1">
            <ArchiveFavicon src={props.item.faviconUrl} title={props.item.title} size="18px" />
            <Stack gap="0" minW="0" flex="1">
              <Text fontSize="sm" fontWeight="semibold" lineClamp="1">
                {props.item.title}
              </Text>
            </Stack>
          </HStack>

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

        <Stack gap="3" px="4" py="4">
          <Link
            href={props.item.originalUrl}
            target="_blank"
            rel="noreferrer"
            display="inline-flex"
            alignItems="center"
            fontSize="sm"
            color="fg.default"
            lineClamp="1"
            title={props.item.originalUrl}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {truncateUrl(props.item.originalUrl)}
          </Link>

          <Show when={props.item.canvasCardMode !== "compact"}>
            <Stack gap="2">
              <Show when={props.item.metaDescription}>
                {(description) => (
                  <HStack alignItems="flex-start" gap="2">
                    <Box
                      px="1.5"
                      py="0.5"
                      borderRadius="full"
                      bg="blue.subtle"
                      color="blue.fg"
                      flexShrink="0"
                    >
                      <Text fontSize="2xs" fontWeight="medium">
                        {SOURCE_STYLES.meta.label}
                      </Text>
                    </Box>
                    <Text
                      fontSize="sm"
                      color="fg.default"
                      lineClamp={props.item.canvasCardMode === "rich" ? 4 : 2}
                    >
                      {description()}
                    </Text>
                  </HStack>
                )}
              </Show>

              <For each={props.item.noteSnippets}>
                {(noteText) => (
                  <HStack alignItems="flex-start" gap="2">
                    <Box
                      px="1.5"
                      py="0.5"
                      borderRadius="full"
                      bg="green.subtle"
                      color="green.fg"
                      flexShrink="0"
                    >
                      <Text fontSize="2xs" fontWeight="medium">
                        {SOURCE_STYLES.note.label}
                      </Text>
                    </Box>
                    <Text
                      fontSize="sm"
                      color="fg.default"
                      lineClamp={props.item.canvasCardMode === "rich" ? 3 : 2}
                    >
                      {noteText}
                    </Text>
                  </HStack>
                )}
              </For>

              <Show
                when={
                  !props.item.metaDescription &&
                  props.item.noteSnippets.length === 0 &&
                  props.item.description
                }
              >
                {(description) => (
                  <HStack alignItems="flex-start" gap="2">
                    <Box
                      px="1.5"
                      py="0.5"
                      borderRadius="full"
                      bg={
                        props.item.descriptionSource === "note" ? "green.subtle" : "blue.subtle"
                      }
                      color={
                        props.item.descriptionSource === "note" ? "green.fg" : "blue.fg"
                      }
                      flexShrink="0"
                    >
                      <Text fontSize="2xs" fontWeight="medium">
                        {props.item.descriptionSource === "note"
                          ? SOURCE_STYLES.note.label
                          : SOURCE_STYLES.meta.label}
                      </Text>
                    </Box>
                    <Text
                      fontSize="sm"
                      color="fg.default"
                      lineClamp={props.item.canvasCardMode === "rich" ? 4 : 2}
                    >
                      {description()}
                    </Text>
                  </HStack>
                )}
              </Show>
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
      </Stack>
    </Box>
  );
};
