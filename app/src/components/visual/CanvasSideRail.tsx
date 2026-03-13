import {
  For,
  Show,
  createMemo,
  createSignal,
  onMount,
  type Accessor,
  type VoidComponent,
} from "solid-js";
import { Portal } from "solid-js/web";
import { Box, Flex, VStack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import * as HoverCard from "~/components/ui/hover-card";
import { Tooltip } from "~/components/ui/tooltip";
import type { UmapRegionItem } from "~/features/umap/region-types";
import type { DocItem } from "~/types/notes";

export const CANVAS_SIDE_RAIL_WIDTH_PX = 200;

export type CanvasSideRailProps = {
  navHeight: Accessor<number>;
  regions: Accessor<UmapRegionItem[]>;
  selectedRegion: Accessor<UmapRegionItem | null>;
  visibleDocs: Accessor<DocItem[]>;
  searchQuery: Accessor<string>;
  hoveredRegionId: Accessor<string | undefined>;
  selectedDocId: Accessor<string | undefined>;
  onHoveredRegionChange: (regionId: string | undefined) => void;
  onHoveredDocChange: (docId: string | undefined) => void;
  onZoomToRegion: (regionId: string) => void;
  onClearRegion: () => void;
  onOpenDoc: (docId: string) => void;
};

function storyMatchesSearch(doc: DocItem, query: string) {
  if (!query) return true;
  const value = query.toLowerCase();
  return (
    doc.title.toLowerCase().includes(value) ||
    doc.path?.toLowerCase().includes(value)
  );
}

export const CanvasSideRail: VoidComponent<CanvasSideRailProps> = (props) => {
  const [mounted, setMounted] = createSignal(false);
  onMount(() => {
    setMounted(true);
  });

  const regionsSorted = createMemo(() =>
    props
      .regions()
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
  );

  const filteredStories = createMemo(() => {
    const query = props.searchQuery().trim();
    return props
      .visibleDocs()
      .filter((doc) => storyMatchesSearch(doc, query))
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title));
  });

  return (
    <Box
      position="absolute"
      zIndex="11"
      right="4"
      top="4"
      bottom="4"
      w={`min(${CANVAS_SIDE_RAIL_WIDTH_PX}px, calc(100vw - 2rem))`}
      pointerEvents="none"
      style={{
        transform: `translateY(${props.navHeight()}px)`,
      }}
    >
      <Flex
        h="full"
        direction="column"
        pointerEvents="auto"
        bg="bg.default"
        borderWidth="1px"
        borderColor="border"
        borderRadius="l3"
        boxShadow="lg"
        overflow="hidden"
        style={{
          background: "rgba(255,255,255,0.92)",
          "backdrop-filter": "blur(12px)",
        }}
      >
        <Show when={props.selectedRegion()}>
          <Box px="2" pt="2" pb="1">
            <Box
              as="button"
              w="full"
              textAlign="left"
              px="3"
              py="1.5"
              borderRadius="l2"
              fontSize="xs"
              color="fg.muted"
              bg="transparent"
              _hover={{ bg: "bg.subtle", color: "fg.default" }}
              onClick={props.onClearRegion}
            >
              All regions
            </Box>
          </Box>
        </Show>

        <Box flex="1" overflowY="auto" px="2" py="2">
          <Show
            when={props.selectedRegion()}
            fallback={
              <VStack alignItems="stretch" gap="1">
                <For each={regionsSorted()}>
                  {(region) => {
                    const isHovered = () => props.hoveredRegionId() === region.id;
                    return (
                      <Tooltip
                        openDelay={200}
                        closeDelay={80}
                        positioning={{ placement: "left-start", strategy: "fixed" }}
                        showArrow
                        arrowTipProps={{
                          bg: "bg.default",
                          borderTopWidth: "1px",
                          borderLeftWidth: "1px",
                          borderColor: "border.default",
                          style: {
                            background: "rgba(255,255,255,0.97)",
                          },
                        }}
                        content={
                          <Box maxW="16rem">
                            <Text fontSize="xs" fontWeight="semibold" color="fg.default">
                              {region.title}
                            </Text>
                            <Text fontSize="xs" color="fg.muted" mt="1">
                              {region.summary || `${region.docCount} stories`}
                            </Text>
                          </Box>
                        }
                        contentProps={{
                          maxW: "16rem",
                          zIndex: "tooltip",
                          bg: "bg.default",
                          color: "fg.default",
                          borderWidth: "1px",
                          borderColor: "border.default",
                          boxShadow: "md",
                          px: "3",
                          py: "2",
                          borderRadius: "l2",
                          style: {
                            background: "rgba(255,255,255,0.97)",
                            "backdrop-filter": "blur(10px)",
                          },
                        }}
                      >
                        <Box
                          as="button"
                          textAlign="left"
                          w="full"
                          px="3"
                          py="1.5"
                          borderRadius="l2"
                          bg={isHovered() ? "bg.subtle" : "transparent"}
                          _hover={{ bg: "bg.subtle" }}
                          onMouseEnter={() => props.onHoveredRegionChange(region.id)}
                          onMouseLeave={() => props.onHoveredRegionChange(undefined)}
                          onFocus={() => props.onHoveredRegionChange(region.id)}
                          onBlur={() => props.onHoveredRegionChange(undefined)}
                          onClick={() => props.onZoomToRegion(region.id)}
                        >
                          <Text fontSize="xs" fontWeight="medium" lineClamp="1" flex="1" minW="0">
                            {region.title}
                          </Text>
                        </Box>
                      </Tooltip>
                    );
                  }}
                </For>
              </VStack>
            }
          >
            <VStack alignItems="stretch" gap="1">
                <For each={filteredStories()}>
                  {(doc) => {
                    const isActive = () => props.selectedDocId() === doc.id;
                    const trigger = (
                      <Box
                        as="button"
                        textAlign="left"
                        w="full"
                        px="3"
                        py="1.5"
                        borderRadius="l2"
                        bg={isActive() ? "bg.subtle" : "transparent"}
                        _hover={{ bg: "bg.subtle" }}
                        onMouseEnter={() => props.onHoveredDocChange(doc.id)}
                        onMouseLeave={() => props.onHoveredDocChange(undefined)}
                        onFocus={() => props.onHoveredDocChange(doc.id)}
                        onBlur={() => props.onHoveredDocChange(undefined)}
                        onClick={() => props.onOpenDoc(doc.id)}
                      >
                        <Text fontSize="xs" fontWeight="medium" lineClamp="1">
                          {doc.title}
                        </Text>
                      </Box>
                    );
                    return (
                      <Show when={mounted()} fallback={trigger}>
                        <HoverCard.Root
                          openDelay={120}
                          closeDelay={80}
                          positioning={{
                            placement: "left-start",
                            offset: { mainAxis: 10 },
                            strategy: "fixed",
                          }}
                        >
                          <HoverCard.Trigger
                            asChild={(triggerProps) => (
                              <span {...triggerProps}>{trigger}</span>
                            )}
                          />
                          <Portal>
                            <HoverCard.Positioner>
                              <HoverCard.Content maxW="18rem" zIndex="popover">
                                <VStack alignItems="stretch" gap="2">
                                  <Text fontSize="sm" fontWeight="semibold">
                                    {doc.title}
                                  </Text>
                                  <Show when={doc.path}>
                                    <Text fontSize="xs" color="fg.muted" fontFamily="mono">
                                      {doc.path}
                                    </Text>
                                  </Show>
                                  <Text fontSize="xs" color="fg.muted">
                                    Updated {new Date(doc.updatedAt).toLocaleDateString()}
                                  </Text>
                                </VStack>
                              </HoverCard.Content>
                            </HoverCard.Positioner>
                          </Portal>
                        </HoverCard.Root>
                      </Show>
                    );
                  }}
                </For>
                <Show when={filteredStories().length === 0}>
                  <Box px="3" py="4">
                    <Text fontSize="sm" color="fg.muted">
                      No stories match the current filter.
                    </Text>
                  </Box>
                </Show>
            </VStack>
          </Show>
        </Box>
      </Flex>
    </Box>
  );
};
