import { ChevronLeftIcon } from "lucide-solid";
import {
  For,
  Show,
  createMemo,
  type Accessor,
  type JSX,
  type VoidComponent,
} from "solid-js";
import { Box, Flex } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import type { UmapRegionItem } from "~/features/umap/region-types";
import type { DocItem } from "~/types/notes";
import { CanvasRailDocRow } from "./CanvasRailDocRow";

export const CANVAS_SIDE_RAIL_WIDTH_PX = 248;

export type CanvasRailMode = "regions" | "region" | "matches" | "notes";

export type CanvasSideRailProps = {
  mode: Accessor<CanvasRailMode>;
  regions: Accessor<UmapRegionItem[]>;
  selectedRegion: Accessor<UmapRegionItem | null>;
  /** Notes listed in region, matches, and notes modes. */
  docs: Accessor<DocItem[]>;
  searchQuery: Accessor<string>;
  hoveredRegionId: Accessor<string | undefined>;
  hoveredDocId: Accessor<string | undefined>;
  selectedDocId: Accessor<string | undefined>;
  onHoveredRegionChange: (regionId: string | undefined) => void;
  onHoveredDocChange: (docId: string | undefined) => void;
  onZoomToRegion: (regionId: string) => void;
  onClearRegion: () => void;
  onOpenDoc: (docId: string) => void;
};

const RAIL_LIST_LIMIT = 400;

const RailHeader = (props: {
  label: string;
  count: number;
  children?: JSX.Element;
}) => (
  <Flex align="baseline" justify="space-between" gap="2" px="3" pt="3" pb="2">
    <Text
      fontSize="xs"
      fontWeight="semibold"
      color="fg.muted"
      textTransform="uppercase"
      letterSpacing="0.06em"
    >
      {props.label}
    </Text>
    <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums">
      {props.count.toLocaleString()}
    </Text>
  </Flex>
);

export const CanvasSideRail: VoidComponent<CanvasSideRailProps> = (props) => {
  const regionsSorted = createMemo(() =>
    props
      .regions()
      .slice()
      .sort(
        (a, b) => b.docCount - a.docCount || a.title.localeCompare(b.title),
      ),
  );
  const listedDocs = createMemo(() => props.docs().slice(0, RAIL_LIST_LIMIT));
  const docsLabel = () => (props.mode() === "matches" ? "Matches" : "Notes");
  const hiddenCount = () => props.docs().length - RAIL_LIST_LIMIT;

  return (
    <Flex direction="column" h="full" minH="0">
      <Show when={props.mode() === "region" && props.selectedRegion()}>
        {(region) => (
          <Box px="2" pt="2" pb="2" bg="bg.subtle">
            <Box
              as="button"
              display="inline-flex"
              alignItems="center"
              gap="1"
              px="1.5"
              py="1"
              borderRadius="l1"
              fontSize="xs"
              color="fg.muted"
              cursor="pointer"
              focusVisibleRing="inside"
              transitionProperty="background-color, color"
              transitionDuration="fast"
              _hover={{ bg: "gray.a3", color: "fg.default" }}
              _active={{ bg: "gray.a5" }}
              onClick={props.onClearRegion}
            >
              <ChevronLeftIcon size={14} />
              All regions
            </Box>
            <Box px="1.5" pt="1">
              <Flex align="flex-start" justify="space-between" gap="2">
                <Text fontSize="sm" fontWeight="semibold" lineHeight="tight">
                  {region().title}
                </Text>
                <Text
                  fontSize="xs"
                  color="fg.muted"
                  fontVariantNumeric="tabular-nums"
                  flexShrink="0"
                  mt="0.5"
                >
                  {props.searchQuery().trim()
                    ? `${props.docs().length} / ${region().docCount}`
                    : region().docCount}
                </Text>
              </Flex>
              <Show when={region().summary}>
                <Text fontSize="xs" color="fg.muted" mt="1" lineClamp="3">
                  {region().summary}
                </Text>
              </Show>
            </Box>
          </Box>
        )}
      </Show>

      <Show when={props.mode() === "regions"}>
        <RailHeader label="Regions" count={regionsSorted().length} />
      </Show>
      <Show when={props.mode() === "matches" || props.mode() === "notes"}>
        <RailHeader label={docsLabel()} count={props.docs().length} />
      </Show>

      <Box
        flex="1"
        minH="0"
        overflowY="auto"
        px="1.5"
        pb="2"
        pt={props.mode() === "region" ? "1.5" : "0"}
      >
        <Show
          when={props.mode() === "regions"}
          fallback={
            <>
              <For each={listedDocs()}>
                {(doc) => (
                  <CanvasRailDocRow
                    doc={doc}
                    query={props.searchQuery()}
                    active={props.selectedDocId() === doc.id}
                    highlighted={props.hoveredDocId() === doc.id}
                    onHover={props.onHoveredDocChange}
                    onOpen={props.onOpenDoc}
                  />
                )}
              </For>
              <Show when={props.docs().length > RAIL_LIST_LIMIT}>
                <Text fontSize="xs" color="fg.muted" px="2" py="2">
                  {props.searchQuery().trim()
                    ? `${hiddenCount().toLocaleString()} more — refine the search to narrow the list`
                    : `${hiddenCount().toLocaleString()} more — search to find the rest`}
                </Text>
              </Show>
              <Show when={props.docs().length === 0}>
                <Text fontSize="sm" color="fg.muted" px="2" py="3">
                  {props.searchQuery().trim()
                    ? `No notes match “${props.searchQuery().trim()}”`
                    : "No notes yet"}
                </Text>
              </Show>
            </>
          }
        >
          <For each={regionsSorted()}>
            {(region) => {
              const isHovered = () => props.hoveredRegionId() === region.id;
              return (
                <Box
                  as="button"
                  display="flex"
                  alignItems="baseline"
                  gap="2"
                  w="full"
                  textAlign="left"
                  px="2"
                  py="1.5"
                  borderRadius="l2"
                  cursor="pointer"
                  focusVisibleRing="inside"
                  transitionProperty="background-color"
                  transitionDuration="fast"
                  bg={isHovered() ? "gray.a3" : "transparent"}
                  _hover={{ bg: "gray.a3" }}
                  _active={{ bg: "gray.a5" }}
                  onMouseEnter={() => props.onHoveredRegionChange(region.id)}
                  onMouseLeave={() => props.onHoveredRegionChange(undefined)}
                  onFocus={() => props.onHoveredRegionChange(region.id)}
                  onBlur={() => props.onHoveredRegionChange(undefined)}
                  onClick={() => props.onZoomToRegion(region.id)}
                >
                  <Text fontSize="sm" flex="1" minW="0" lineHeight="snug">
                    {region.title}
                  </Text>
                  <Text
                    fontSize="xs"
                    color="fg.muted"
                    fontVariantNumeric="tabular-nums"
                    flexShrink="0"
                  >
                    {region.docCount}
                  </Text>
                </Box>
              );
            }}
          </For>
        </Show>
      </Box>
    </Flex>
  );
};
