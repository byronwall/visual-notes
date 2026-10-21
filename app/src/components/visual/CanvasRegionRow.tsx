import { For, Show, type VoidComponent } from "solid-js";
import { Portal } from "solid-js/web";
import { Box, VStack } from "styled-system/jsx";
import * as HoverCard from "~/components/ui/hover-card";
import { Text } from "~/components/ui/text";
import type { UmapRegionItem } from "~/features/umap/region-types";

const PREVIEW_NOTE_COUNT = 2;

export type CanvasRegionRowProps = {
  region: UmapRegionItem;
  islandTitle: string | null;
  activityLabel: string | null;
  highlighted: boolean;
  onHover: (regionId: string | undefined) => void;
  onZoom: (regionId: string) => void;
  onOpenDoc: (docId: string) => void;
};

/**
 * One region in the canvas rail: title, size, summary, its first notes, and
 * recent activity. Hovering spotlights the region on the map; the hover card
 * carries the full summary and every sample note.
 */
export const CanvasRegionRow: VoidComponent<CanvasRegionRowProps> = (props) => {
  const previewDocs = () =>
    props.region.sampleDocs.slice(0, PREVIEW_NOTE_COUNT);

  return (
    <HoverCard.Root
      openDelay={600}
      closeDelay={80}
      positioning={{
        placement: "left-start",
        offset: { mainAxis: 12 },
        strategy: "fixed",
      }}
    >
      <HoverCard.Trigger
        asChild={(triggerProps) => (
          <Box
            {...triggerProps()}
            as="button"
            display="flex"
            flexDirection="column"
            gap="0.5"
            w="full"
            textAlign="left"
            px="2"
            py="1.5"
            borderRadius="l2"
            cursor="pointer"
            focusVisibleRing="inside"
            transitionProperty="background-color"
            transitionDuration="fast"
            bg={props.highlighted ? "gray.a3" : "transparent"}
            _hover={{ bg: "gray.a3" }}
            _active={{ bg: "gray.a5" }}
            onMouseEnter={() => props.onHover(props.region.id)}
            onMouseLeave={() => props.onHover(undefined)}
            onFocus={() => props.onHover(props.region.id)}
            onBlur={() => props.onHover(undefined)}
            onClick={() => props.onZoom(props.region.id)}
          >
            <Box display="flex" alignItems="baseline" gap="2" w="full">
              <Text
                fontSize="sm"
                fontWeight="medium"
                lineHeight="snug"
                flex="1"
                minW="0"
              >
                {props.region.title}
              </Text>
              <Text
                fontSize="xs"
                color="fg.muted"
                fontVariantNumeric="tabular-nums"
                flexShrink="0"
              >
                {props.region.docCount.toLocaleString()}
              </Text>
            </Box>
            <Show when={props.region.summary}>
              <Text
                fontSize="xs"
                color="fg.muted"
                lineHeight="snug"
                truncate
                w="full"
              >
                {props.region.summary}
              </Text>
            </Show>
            <Show when={previewDocs().length > 0}>
              <Box w="full" minW="0">
                <For each={previewDocs()}>
                  {(doc) => (
                    <Text
                      fontSize="xs"
                      color="fg.subtle"
                      lineHeight="snug"
                      truncate
                    >
                      · {doc.title}
                    </Text>
                  )}
                </For>
              </Box>
            </Show>
            <Show when={props.activityLabel}>
              <Text
                fontSize="xs"
                color="fg.subtle"
                lineHeight="snug"
                fontVariantNumeric="tabular-nums"
              >
                {props.activityLabel}
              </Text>
            </Show>
          </Box>
        )}
      />
      <Portal>
        <HoverCard.Positioner>
          <HoverCard.Content maxW="22rem" zIndex="popover" p="3">
            <VStack alignItems="stretch" gap="1.5">
              <Box>
                <Show when={props.islandTitle}>
                  <Text fontSize="xs" color="fg.muted">
                    {props.islandTitle}
                  </Text>
                </Show>
                <Text fontSize="sm" fontWeight="semibold">
                  {props.region.title}
                </Text>
              </Box>
              <Show when={props.region.summary}>
                <Text fontSize="xs" color="fg.muted">
                  {props.region.summary}
                </Text>
              </Show>
              <Show when={props.region.sampleDocs.length > 0}>
                <VStack alignItems="stretch" gap="0">
                  <For each={props.region.sampleDocs}>
                    {(doc) => (
                      <Box
                        as="button"
                        textAlign="left"
                        fontSize="xs"
                        color="fg.default"
                        px="1.5"
                        py="1"
                        mx="-1.5"
                        borderRadius="l1"
                        cursor="pointer"
                        focusVisibleRing="inside"
                        transitionProperty="background-color"
                        transitionDuration="fast"
                        _hover={{ bg: "gray.a3" }}
                        _active={{ bg: "gray.a5" }}
                        onClick={() => props.onOpenDoc(doc.docId)}
                      >
                        {doc.title}
                      </Box>
                    )}
                  </For>
                </VStack>
              </Show>
              <Text
                fontSize="xs"
                color="fg.subtle"
                fontVariantNumeric="tabular-nums"
              >
                {props.region.docCount.toLocaleString()} notes
                {props.activityLabel ? ` · ${props.activityLabel}` : ""}
              </Text>
            </VStack>
          </HoverCard.Content>
        </HoverCard.Positioner>
      </Portal>
    </HoverCard.Root>
  );
};
