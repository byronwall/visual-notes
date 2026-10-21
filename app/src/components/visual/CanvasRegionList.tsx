import {
  For,
  Show,
  createMemo,
  createSignal,
  type Accessor,
  type VoidComponent,
} from "solid-js";
import { Box, Flex } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import type {
  UmapIslandItem,
  UmapRegionItem,
} from "~/features/umap/region-types";
import { CanvasRegionRow } from "./CanvasRegionRow";
import { CanvasRegionSortToggle } from "./CanvasRegionSortToggle";
import {
  formatRegionActivity,
  groupRegions,
  type RegionActivity,
  type RegionSort,
} from "./canvas-region-list";

export type CanvasRegionListProps = {
  regions: Accessor<UmapRegionItem[]>;
  islands: Accessor<UmapIslandItem[]>;
  activityById: Accessor<Map<string, RegionActivity>>;
  hoveredRegionId: Accessor<string | undefined>;
  onHoveredRegionChange: (regionId: string | undefined) => void;
  onZoomToRegion: (regionId: string) => void;
  onOpenDoc: (docId: string) => void;
};

/** Header plus scrolling region list; Map order groups regions by island. */
export const CanvasRegionList: VoidComponent<CanvasRegionListProps> = (
  props,
) => {
  const [sort, setSort] = createSignal<RegionSort>("map");
  const groups = createMemo(() =>
    groupRegions(
      props.regions(),
      props.islands(),
      sort(),
      props.activityById(),
    ),
  );
  const islandTitleById = createMemo(
    () => new Map(props.islands().map((island) => [island.id, island.title])),
  );

  return (
    <>
      <Flex
        align="center"
        justify="space-between"
        gap="2"
        px="3"
        pt="2.5"
        pb="1.5"
      >
        <Flex align="baseline" gap="1.5">
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="0.06em"
          >
            Regions
          </Text>
          <Text
            fontSize="xs"
            color="fg.subtle"
            fontVariantNumeric="tabular-nums"
          >
            {props.regions().length.toLocaleString()}
          </Text>
        </Flex>
        <CanvasRegionSortToggle value={sort()} onChange={setSort} />
      </Flex>
      <Box flex="1" minH="0" overflowY="auto" px="1.5" pb="2">
        <For each={groups()}>
          {(group, index) => (
            <Box as="section" pb="1.5">
              <Show when={group.title}>
                <Flex
                  align="baseline"
                  justify="space-between"
                  gap="2"
                  px="2"
                  pt="2"
                  pb="0.5"
                  borderTopWidth={index() > 0 ? "1px" : "0"}
                  borderColor="border"
                >
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    color="fg.default"
                    truncate
                    minW="0"
                  >
                    {group.title}
                  </Text>
                  <Text
                    fontSize="xs"
                    color="fg.subtle"
                    fontVariantNumeric="tabular-nums"
                    flexShrink="0"
                  >
                    {group.docCount.toLocaleString()}
                  </Text>
                </Flex>
              </Show>
              <For each={group.regions}>
                {(region) => (
                  <CanvasRegionRow
                    region={region}
                    islandTitle={islandTitleById().get(region.islandId) ?? null}
                    activityLabel={formatRegionActivity(
                      props.activityById().get(region.id),
                    )}
                    highlighted={props.hoveredRegionId() === region.id}
                    onHover={props.onHoveredRegionChange}
                    onZoom={props.onZoomToRegion}
                    onOpenDoc={props.onOpenDoc}
                  />
                )}
              </For>
            </Box>
          )}
        </For>
      </Box>
    </>
  );
};
