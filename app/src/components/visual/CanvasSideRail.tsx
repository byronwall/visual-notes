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
import type {
  UmapIslandItem,
  UmapRegionItem,
} from "~/features/umap/region-types";
import type { DocItem } from "~/types/notes";
import { CanvasRailDocRow } from "./CanvasRailDocRow";
import { CanvasRegionList } from "./CanvasRegionList";
import {
  formatRegionActivity,
  regionActivity,
  type RegionActivity,
} from "./canvas-region-list";

export const CANVAS_SIDE_RAIL_WIDTH_PX = 272;

export type CanvasRailMode = "regions" | "region" | "matches" | "notes";

export type CanvasSideRailProps = {
  mode: Accessor<CanvasRailMode>;
  regions: Accessor<UmapRegionItem[]>;
  islands: Accessor<UmapIslandItem[]>;
  /** Every loaded note; region activity reads their `updatedAt`. */
  allDocs: Accessor<DocItem[]>;
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
  /** The note panel covers the rail, so hover cards would float over it. */
  noteOpen: Accessor<boolean>;
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
  const activityById = createMemo(() => {
    const updatedAtById = new Map(
      props.allDocs().map((doc) => [doc.id, doc.updatedAt]),
    );
    const now = Date.now();
    return new Map<string, RegionActivity>(
      props
        .regions()
        .map((region) => [
          region.id,
          regionActivity(region.docIds, updatedAtById, now),
        ]),
    );
  });
  const islandTitle = (region: UmapRegionItem) =>
    props.islands().find((island) => island.id === region.islandId)?.title;
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
              <Show when={islandTitle(region())}>
                <Text fontSize="xs" color="fg.subtle" truncate>
                  {islandTitle(region())}
                </Text>
              </Show>
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
              <Show
                when={formatRegionActivity(activityById().get(region().id))}
              >
                {(label) => (
                  <Text
                    fontSize="xs"
                    color="fg.subtle"
                    mt="1"
                    fontVariantNumeric="tabular-nums"
                  >
                    {label()}
                  </Text>
                )}
              </Show>
            </Box>
          </Box>
        )}
      </Show>

      <Show when={props.mode() === "matches" || props.mode() === "notes"}>
        <RailHeader label={docsLabel()} count={props.docs().length} />
      </Show>

      <Show
        when={props.mode() !== "regions"}
        fallback={
          <CanvasRegionList
            regions={props.regions}
            islands={props.islands}
            activityById={activityById}
            hoveredRegionId={props.hoveredRegionId}
            onHoveredRegionChange={props.onHoveredRegionChange}
            onZoomToRegion={props.onZoomToRegion}
            onOpenDoc={props.onOpenDoc}
            hoverCardsDisabled={props.noteOpen()}
          />
        }
      >
        <Box
          flex="1"
          minH="0"
          overflowY="auto"
          px="1.5"
          pb="2"
          pt={props.mode() === "region" ? "1.5" : "0"}
        >
          <For each={listedDocs()}>
            {(doc) => (
              <CanvasRailDocRow
                doc={doc}
                query={props.searchQuery()}
                active={props.selectedDocId() === doc.id}
                highlighted={props.hoveredDocId() === doc.id}
                onHover={props.onHoveredDocChange}
                onOpen={props.onOpenDoc}
                hoverCardDisabled={props.noteOpen()}
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
        </Box>
      </Show>
    </Flex>
  );
};
