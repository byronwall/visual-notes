import { createAsync, useNavigate } from "@solidjs/router";
import { WaypointsIcon } from "lucide-solid";
import { For, Show, createMemo, createSignal, type VoidComponent } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { fetchNearbyUmapDocs } from "~/services/umap.service";
import { colorFor } from "~/utils/colors";
import { IconButton } from "~/components/ui/icon-button";
import { Skeleton, SkeletonText } from "~/components/ui/skeleton";
import { SimplePopover } from "~/components/ui/simple-popover";
import { Text } from "~/components/ui/text";

type PlotPoint = {
  id: string;
  title: string;
  path?: string | null;
  x: number;
  y: number;
  plotX: number;
  plotY: number;
  isCurrent: boolean;
};

const PLOT_WIDTH = 228;
const PLOT_HEIGHT = 150;
const PLOT_PADDING = 12;
const TOOLTIP_OFFSET_X = 12;
const TOOLTIP_OFFSET_Y = -10;

export const NearbyNodesPopover: VoidComponent<{ docId?: string }> = (props) => {
  const navigate = useNavigate();
  const [open, setOpen] = createSignal(false);
  const [hoveredDocId, setHoveredDocId] = createSignal<string | undefined>();
  const [mouse, setMouse] = createSignal({ x: 0, y: 0 });

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

  const commonPaths = createMemo(() => {
    const counts = new Map<string, number>();
    for (const point of plotPoints()) {
      if (point.isCurrent) continue;
      const path = String(point.path || "").trim();
      if (!path) continue;
      counts.set(path, (counts.get(path) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
      .slice(0, 6);
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
              onPointerMove={(event) => {
                if (!hoveredDocId()) return;
                const rect = event.currentTarget.getBoundingClientRect();
                setMouse({
                  x: event.clientX - rect.left,
                  y: event.clientY - rect.top,
                });
              }}
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
                      onPointerEnter={(event) => {
                        setHoveredDocId(point.id);
                        const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                        if (!rect) return;
                        setMouse({
                          x: event.clientX - rect.left,
                          y: event.clientY - rect.top,
                        });
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
                  left: `${mouse().x + TOOLTIP_OFFSET_X}px`,
                  top: `${mouse().y + TOOLTIP_OFFSET_Y}px`,
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

        <Show when={!isInitialLoading()} fallback={<SkeletonText noOfLines={3} gap="2" />}>
          <Show
            when={commonPaths().length > 0}
            fallback={
              <Text fontSize="sm" color="fg.muted">
                No nearby paths available in the latest UMAP run for this note.
              </Text>
            }
          >
            <Stack gap="1">
              <Text fontSize="xs" color="fg.muted">
                Common nearby paths
              </Text>
              <Stack gap="1">
                <For each={commonPaths()}>
                  {(item) => (
                    <HStack gap="2" justifyContent="space-between">
                      <Text fontSize="xs" color="fg.default" maxW="18rem" truncate>
                        {item.path}
                      </Text>
                      <Text fontSize="xs" color="fg.muted" fontFamily="mono">
                        {item.count}
                      </Text>
                    </HStack>
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
