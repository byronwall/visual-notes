import { ExternalLinkIcon, GripVerticalIcon, ImageIcon } from "lucide-solid";
import { createSignal, For, Show, type JSX } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import type {
  ArchivedPageCanvasCardMode,
  ArchivedPageCanvasItem,
} from "~/services/archive/archive.types";

type Props = {
  item: ArchivedPageCanvasItem;
  isDragging: boolean;
  onDragStart: JSX.EventHandlerUnion<HTMLButtonElement, PointerEvent>;
  onModeChange: (mode: ArchivedPageCanvasCardMode) => void;
};

function truncateUrl(url: string, maxLength = 48) {
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

export const ArchiveCanvasCard = (props: Props) => {
  const [cardMode, setCardMode] = createSignal<ArchivedPageCanvasCardMode>(
    props.item.canvasCardMode,
  );

  return (
    <Box
      w="320px"
      maxW="320px"
      borderRadius="l3"
      borderWidth="1px"
      borderColor={props.isDragging ? "border.accent" : "border"}
      bg="bg.default"
      boxShadow={props.isDragging ? "md" : "sm"}
      overflow="hidden"
      style={{
        "touch-action": "none",
      }}
    >
      <Stack gap="0">
        <HStack
          justify="space-between"
          gap="2"
          px="3"
          py="2"
          bg="bg.subtle"
          borderBottomWidth="1px"
          borderColor="border"
        >
          <HStack gap="2" minW="0" flex="1">
            <Button
              type="button"
              variant="plain"
              size="xs"
              px="1.5"
              minH="7"
              cursor={props.isDragging ? "grabbing" : "grab"}
              aria-label={`Drag ${props.item.title}`}
              onPointerDown={props.onDragStart}
            >
              <GripVerticalIcon size={14} />
            </Button>
            <Stack gap="0.5" minW="0" flex="1">
              <Text fontSize="sm" fontWeight="semibold" lineClamp="2">
                {props.item.title}
              </Text>
              <Show when={props.item.siteHostname}>
                {(host) => (
                  <Text fontSize="xs" color="fg.muted" fontFamily="mono" lineClamp="1">
                    {host()}
                  </Text>
                )}
              </Show>
            </Stack>
          </HStack>

          <HStack gap="1">
            <For each={MODE_OPTIONS}>
              {(option) => (
                <Button
                  type="button"
                  size="xs"
                  variant={cardMode() === option.value ? "solid" : "plain"}
                  aria-label={`Show ${option.value} card`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setCardMode(option.value);
                    props.onModeChange(option.value);
                  }}
                >
                  {option.label}
                </Button>
              )}
            </For>
          </HStack>
        </HStack>

        <Stack gap="3" px="4" py="4">
          <Show when={cardMode() === "compact"}>
            <Text fontSize="sm" color="fg.muted" lineClamp="1">
              {truncateUrl(props.item.originalUrl)}
            </Text>
          </Show>

          <Show when={cardMode() === "summary"}>
            <>
              <Text fontSize="sm" color="fg.muted" lineClamp="1" fontFamily="mono">
                {truncateUrl(props.item.originalUrl)}
              </Text>
              <Show when={props.item.description}>
                {(description) => (
                  <Text fontSize="sm" color="fg.default" lineClamp="4">
                    {description()}
                  </Text>
                )}
              </Show>
            </>
          </Show>

          <Show when={cardMode() === "rich"}>
            <>
              <Text fontSize="sm" color="fg.muted" lineClamp="1" fontFamily="mono">
                {truncateUrl(props.item.originalUrl)}
              </Text>
              <Show when={props.item.description}>
                {(description) => (
                  <Text fontSize="sm" color="fg.default" lineClamp="5">
                    {description()}
                  </Text>
                )}
              </Show>
              <Show when={props.item.preferredImages.length > 0}>
                <Stack gap="2">
                  <HStack gap="1.5" alignItems="center">
                    <ImageIcon size={12} />
                    <Text fontSize="xs" color="fg.muted">
                      Images
                    </Text>
                  </HStack>
                  <Box display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="2">
                    <For each={props.item.preferredImages}>
                      {(src) => (
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
                      )}
                    </For>
                  </Box>
                </Stack>
              </Show>
            </>
          </Show>

          <HStack justify="space-between" alignItems="center" gap="2">
            <Text fontSize="xs" color="fg.muted">
              {props.item.groupName}
            </Text>
            <Button
              type="button"
              size="xs"
              variant="plain"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                window.open(props.item.originalUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <ExternalLinkIcon size={12} />
            </Button>
          </HStack>
        </Stack>
      </Stack>
    </Box>
  );
};
