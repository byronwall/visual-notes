import { createAsync, useNavigate } from "@solidjs/router";
import { WaypointsIcon } from "lucide-solid";
import { For, Show, createMemo, createSignal, type VoidComponent } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { PathPillLink } from "~/components/path/PathPillLink";
import { Button } from "~/components/ui/button";
import { fetchNearbyUmapDocs } from "~/services/umap.service";
import { colorFor } from "~/utils/colors";
import { IconButton } from "~/components/ui/icon-button";
import { Skeleton, SkeletonText } from "~/components/ui/skeleton";
import { SimplePopover } from "~/components/ui/simple-popover";
import { Text } from "~/components/ui/text";
import { normalizeDotPath, pathToRoute } from "~/utils/path-links";

type PlotPoint = {
  id: string;
  title: string;
  path?: string | null;
  x: number;
  y: number;
  distance: number;
  plotX: number;
  plotY: number;
  isCurrent: boolean;
};

const PLOT_WIDTH = 228;
const PLOT_HEIGHT = 150;
const PLOT_PADDING = 12;
const TOOLTIP_OFFSET_X = 12;
const TOOLTIP_OFFSET_Y = -10;

const formatDistance = (distance: number) => {
  if (distance < 0.1) return distance.toFixed(3);
  if (distance < 1) return distance.toFixed(2);
  return distance.toFixed(1);
};

export const NearbyNodesPopover: VoidComponent<{ docId?: string }> = (props) => {
  const navigate = useNavigate();
  const [open, setOpen] = createSignal(false);
  const [hoveredDocId, setHoveredDocId] = createSignal<string | undefined>();

  const nearby = createAsync(() =>
    open() && props.docId
      ? fetchNearbyUmapDocs({ docId: props.docId, take: 36 })
      : Promise.resolve({ points: [] })
  );
  const nearbyData = createMemo(() => nearby.latest ?? nearby() ?? { points: [] });
  const isInitialLoading = createMemo(() => open() && !nearby.latest && !nearby());

  const plotPoints = createMemo<PlotPoint[]>(() => {
    const points = nearbyData().points || [];
    if (points.length === 0) return [];

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const point of points) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }

    const drawW = PLOT_WIDTH - PLOT_PADDING * 2;
    const drawH = PLOT_HEIGHT - PLOT_PADDING * 2;
    const spanX = Math.max(0.001, maxX - minX);
    const spanY = Math.max(0.001, maxY - minY);

    return points.map((point) => ({
      id: point.id,
      title: point.title,
      path: point.path,
      x: point.x,
      y: point.y,
      distance: point.distance,
      plotX: PLOT_PADDING + ((point.x - minX) / spanX) * drawW,
      plotY: PLOT_HEIGHT - PLOT_PADDING - ((point.y - minY) / spanY) * drawH,
      isCurrent: point.id === props.docId,
    }));
  });

  const hoveredPoint = createMemo(() => {
    const id = hoveredDocId();
    if (!id) return undefined;
    return plotPoints().find((point) => point.id === id);
  });

  const nearbyDocs = createMemo(() =>
    plotPoints()
      .filter((point) => !point.isCurrent)
      .sort((a, b) => a.distance - b.distance || a.title.localeCompare(b.title))
  );

  const commonPaths = createMemo(() => {
    const byPath = new Map<string, number>();
    for (const point of nearbyDocs()) {
      const normalizedPath = normalizeDotPath(point.path || "");
      if (!normalizedPath) continue;
      const existing = byPath.get(normalizedPath);
      if (existing === undefined || point.distance < existing) {
        byPath.set(normalizedPath, point.distance);
      }
    }

    return Array.from(byPath.entries())
      .map(([path, distance]) => ({ path, distance }))
      .sort((a, b) => a.distance - b.distance || a.path.localeCompare(b.path));
  });

  return (
    <SimplePopover
      open={open()}
      onClose={() => {
        setOpen(false);
        setHoveredDocId(undefined);
      }}
      placement="bottom-start"
      offset={8}
      anchor={
        <IconButton
          size="sm"
          variant="outline"
          aria-label="Nearby notes via UMAP"
          onClick={() => setOpen((value) => !value)}
          disabled={!props.docId}
        >
          <WaypointsIcon size={16} />
        </IconButton>
      }
    >
      <Stack gap="2.5" p="3">
        <HStack gap="2" alignItems="baseline" justifyContent="space-between">
          <Text fontSize="sm" fontWeight="semibold">
            Nearby nodes
          </Text>
          <Text fontSize="xs" color="fg.muted">
            UMAP minimap
          </Text>
        </HStack>

        <Box
          borderWidth="1px"
          borderColor="border"
          borderRadius="l2"
          p="2"
          position="relative"
          onPointerLeave={() => setHoveredDocId(undefined)}
        >
          <Show
            when={!isInitialLoading()}
            fallback={
              <Skeleton
                width={`${PLOT_WIDTH}px`}
                height={`${PLOT_HEIGHT}px`}
                borderRadius="l1"
              />
            }
          >
            <svg
              width={PLOT_WIDTH}
              height={PLOT_HEIGHT}
              viewBox={`0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT}`}
              role="img"
              aria-label="Nearby notes scatter plot"
            >
              <rect x="0" y="0" width={PLOT_WIDTH} height={PLOT_HEIGHT} fill="transparent" />
              <For each={plotPoints()}>
                {(point) => {
                  const hovered = () => hoveredDocId() === point.id;
                  const radius = () => (point.isCurrent ? 6.5 : hovered() ? 6 : 5);
                  return (
                    <circle
                      cx={point.plotX}
                      cy={point.plotY}
                      r={radius()}
                      fill={colorFor(point.path || point.title)}
                      stroke={hovered() || point.isCurrent ? "black" : "white"}
                      stroke-width={hovered() || point.isCurrent ? 1.6 : 1}
                      style={{ cursor: "pointer" }}
                      onPointerEnter={() => {
                        setHoveredDocId(point.id);
                      }}
                      onPointerLeave={() => setHoveredDocId(undefined)}
                      onClick={() => {
                        setOpen(false);
                        navigate(`/docs/${point.id}`);
                      }}
                    />
                  );
                }}
              </For>
            </svg>
          </Show>

          <Show when={hoveredPoint()}>
            {(point) => (
              <Box
                position="absolute"
                pointerEvents="none"
                px="2"
                py="1"
                borderRadius="l1"
                bg="bg.default"
                borderWidth="1px"
                borderColor="border"
                maxW="16rem"
                boxShadow="sm"
                zIndex="tooltip"
                style={{
                  left: `${point().plotX + TOOLTIP_OFFSET_X}px`,
                  top: `${point().plotY + TOOLTIP_OFFSET_Y}px`,
                  transform: "translateY(-100%)",
                }}
              >
                <Text fontSize="xs" color="fg.default" fontWeight="medium" truncate>
                  {point().title || "Untitled"}
                </Text>
              </Box>
            )}
          </Show>
        </Box>

        <Show when={!isInitialLoading()} fallback={<SkeletonText noOfLines={5} gap="2" />}>
          <Show
            when={nearbyDocs().length > 0}
            fallback={
              <Text fontSize="sm" color="fg.muted">
                No nearby documents available in the latest UMAP run for this note.
              </Text>
            }
          >
            <Stack gap="2" minH="0">
              <Show when={commonPaths().length > 0}>
                <HStack gap="1.5" flexWrap="wrap">
                  <For each={commonPaths()}>
                    {(item) => (
                      <PathPillLink
                        href={pathToRoute(item.path)}
                        variant="outline"
                        onClick={() => setOpen(false)}
                      >
                        {item.path}
                      </PathPillLink>
                    )}
                  </For>
                </HStack>
              </Show>
              <Stack gap="1" maxH="15rem" overflowY="auto" pr="1">
                <For each={nearbyDocs()}>
                  {(item) => (
                    <Button
                      size="sm"
                      variant="plain"
                      w="full"
                      justifyContent="flex-start"
                      alignItems="center"
                      h="auto"
                      minH="unset"
                      px="2"
                      py="1.5"
                      textAlign="left"
                      onMouseEnter={() => setHoveredDocId(item.id)}
                      onMouseLeave={() => setHoveredDocId(undefined)}
                      onClick={() => {
                        setOpen(false);
                        navigate(`/docs/${item.id}`);
                      }}
                    >
                      <HStack gap="2" w="full" minW="0" alignItems="center">
                        <Box
                          boxSize="2.5"
                          borderRadius="full"
                          flexShrink="0"
                          style={{
                            background: colorFor(item.path || item.title),
                          }}
                        />
                        <Stack gap="0.5" alignItems="flex-start" minW="0" flex="1">
                          <HStack
                            w="full"
                            minW="0"
                            alignItems="flex-start"
                            justifyContent="space-between"
                          >
                            <Text
                              fontSize="xs"
                              color="fg.default"
                              fontWeight="medium"
                              truncate
                              flex="1"
                              minW="0"
                            >
                              {item.title || "Untitled"}
                            </Text>
                            <Text
                              fontSize="xs"
                              color="fg.muted"
                              fontFamily="mono"
                              flexShrink="0"
                              pl="2"
                            >
                              {formatDistance(item.distance)}
                            </Text>
                          </HStack>
                        </Stack>
                      </HStack>
                    </Button>
                  )}
                </For>
              </Stack>
            </Stack>
          </Show>
        </Show>
      </Stack>
    </SimplePopover>
  );
};
