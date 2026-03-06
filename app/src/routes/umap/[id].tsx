import {
  type VoidComponent,
  For,
  Show,
  createSignal,
  createEffect,
  onMount,
  Suspense,
} from "solid-js";
import { createAsync, revalidate, useAction, useNavigate, useParams } from "@solidjs/router";
import { RotateCcwIcon } from "lucide-solid";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Heading } from "~/components/ui/heading";
import { IconButton } from "~/components/ui/icon-button";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";
import { Box, Container, Flex, Grid, HStack, Stack } from "styled-system/jsx";
import {
  fetchUmapPointsForRun,
  fetchUmapRun,
} from "~/services/umap/umap.queries";
import { deleteUmapRun } from "~/services/umap/umap.actions";

type Point = { docId: string; x: number; y: number; z?: number | null };
type PointsData = { runId: string; dims: number; points: Point[] };
type RunMeta = {
  id: string;
  dims: number;
  params?: Record<string, unknown> | null;
  embeddingRunId: string;
  createdAt: string;
  count?: number;
  hasArtifact?: boolean;
  artifactPath?: string | null;
};

function formatParamValue(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getParamEntries(params?: Record<string, unknown> | null): [string, unknown][] {
  return Object.entries(params ?? {}).sort(([a], [b]) => a.localeCompare(b));
}

const UmapDetail: VoidComponent = () => {
  const params = useParams();
  const navigate = useNavigate();
  const meta = createAsync(() => {
    if (!params.id) return Promise.resolve<RunMeta | null>(null);
    return fetchUmapRun(params.id) as Promise<RunMeta | null>;
  });
  const data = createAsync(() => {
    if (!params.id) return Promise.resolve<PointsData | null>(null);
    return fetchUmapPointsForRun(params.id) as Promise<PointsData | null>;
  });
  const runDelete = useAction(deleteUmapRun);
  const refreshPoints = () => {
    if (!params.id) return;
    void revalidate(fetchUmapPointsForRun.keyFor(params.id));
  };
  const [busy, setBusy] = createSignal(false);
  const [canvasWidth, setCanvasWidth] = createSignal(800);
  const [canvasHeight, setCanvasHeight] = createSignal(420);
  let canvasEl: HTMLCanvasElement | undefined;
  let canvasContainerEl: HTMLDivElement | undefined;
  let ro: ResizeObserver | undefined;

  onMount(() => {
    if (!canvasContainerEl) return;
    if (typeof window === "undefined") return;

    ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(320, Math.floor(entry.contentRect.width));
        const h = Math.max(200, Math.floor(entry.contentRect.height || 0));
        // Maintain a 2:1 aspect if height not present
        const height = h > 0 ? h : Math.floor(w / 2);
        setCanvasWidth(w);
        setCanvasHeight(height);
      }
    });
    ro.observe(canvasContainerEl);

    return () => {
      ro?.disconnect();
    };
  });

  createEffect(() => {
    const d = data();
    const pts = d?.points || [];
    const dims = d?.dims || 2;
    const w = canvasWidth();
    const h = canvasHeight();
    if (!canvasEl) return;
    if (!w || !h) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    // Set canvas internal size for crisp rendering
    canvasEl.width = Math.floor(w * dpr);
    canvasEl.height = Math.floor(h * dpr);
    canvasEl.style.width = `${w}px`;
    canvasEl.style.height = `${h}px`;
    ctx.reset?.();
    if (dpr !== 1) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    ctx.clearRect(0, 0, w, h);

    if (pts.length === 0) {
      // empty state
      ctx.fillStyle = "#6b7280"; // gray-500
      ctx.font = "12px ui-sans-serif, system-ui, -apple-system";
      ctx.fillText("No points to display", 12, 20);
      return;
    }

    // Compute bounds
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (p.z != null) {
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
      }
    }
    if (!Number.isFinite(minZ)) {
      minZ = 0;
      maxZ = 1;
    }
    // Avoid zero range
    const pad = 12;
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const sx = (w - pad * 2) / rangeX;
    const sy = (h - pad * 2) / rangeY;

    // Draw frame
    ctx.strokeStyle = "#e5e7eb"; // gray-200
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // Draw points
    const baseColor = "#2563eb"; // blue-600
    for (const p of pts) {
      const px = pad + (p.x - minX) * sx;
      // invert y for canvas
      const py = h - pad - (p.y - minY) * sy;
      let color = baseColor;
      if (dims === 3 && p.z != null && Number.isFinite(p.z)) {
        const t = (p.z - minZ) / (maxZ - minZ || 1);
        const light = 40 + Math.floor(t * 40); // 40-80
        color = `hsl(220 90% ${light}%)`;
      }
      ctx.fillStyle = color;
      const r = 2;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  const handleDelete = async () => {
    if (!confirm("Delete this UMAP run?")) return;
    try {
      setBusy(true);
      console.log("[UmapDetail] deleteRun", { id: params.id });
      await runDelete({ id: params.id });
      navigate("/umap");
    } catch (e) {
      console.error(e);
      alert("Failed to delete run");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container py="4" px="4" maxW="1440px">
        <Suspense
          fallback={
            <Box borderWidth="1px" borderColor="border" borderRadius="l3" p="4">
              <Text textStyle="sm" color="fg.muted">
                Loading run…
              </Text>
            </Box>
          }
        >
          <Show
            when={meta()}
            fallback={
              <Box borderWidth="1px" borderColor="border" borderRadius="l3" p="4">
                <Text textStyle="sm" color="fg.muted">
                  This UMAP run could not be loaded.
                </Text>
                <Box mt="3">
                  <Link href="/umap">Back to UMAP</Link>
                </Box>
              </Box>
            }
          >
            {(m) => {
              const paramEntries = getParamEntries(m().params);
              return (
                <Grid
                  gridTemplateColumns={{
                    base: "1fr",
                    xl: "minmax(0, 1.9fr) minmax(320px, 1fr)",
                  }}
                  gap="4"
                  alignItems="start"
                >
                  <Suspense
                    fallback={
                      <Box borderWidth="1px" borderColor="border" borderRadius="l3" p="4">
                        <Text textStyle="sm" color="fg.muted">
                          Loading points…
                        </Text>
                      </Box>
                    }
                  >
                    <Show
                      when={data()}
                      fallback={
                        <Box borderWidth="1px" borderColor="border" borderRadius="l3" p="4">
                          <Text textStyle="sm" color="fg.muted">
                            No point data available for this run yet.
                          </Text>
                        </Box>
                      }
                    >
                      {(d) => (
                        <Box
                          borderWidth="1px"
                          borderColor="border"
                          borderRadius="l3"
                          overflow="hidden"
                        >
                          <Flex
                            align="center"
                            justify="space-between"
                            gap="3"
                            flexWrap="wrap"
                            px="4"
                            py="3"
                            borderBottomWidth="1px"
                            borderColor="border"
                          >
                            <HStack gap="2" flexWrap="wrap">
                              <Heading as="h1" fontSize="xl">
                                UMAP Run
                              </Heading>
                              <Badge colorPalette="blue">{d().dims}D</Badge>
                              <Badge colorPalette="gray">
                                {d().points.length.toLocaleString()} points
                              </Badge>
                            </HStack>
                            <HStack gap="2" flexWrap="wrap">
                              <Tooltip content="Refresh points" showArrow>
                                <IconButton
                                  size="xs"
                                  variant="outline"
                                  aria-label="Refresh points"
                                  onClick={refreshPoints}
                                >
                                  <RotateCcwIcon size={12} />
                                </IconButton>
                              </Tooltip>
                              <Link href="/umap">Back to UMAP</Link>
                              <Button
                                size="sm"
                                variant="solid"
                                colorPalette="red"
                                loading={busy()}
                                onClick={handleDelete}
                              >
                                Delete Run
                              </Button>
                            </HStack>
                          </Flex>

                          <Box
                            ref={(el) => (canvasContainerEl = el)}
                            w="full"
                            style={{ height: "clamp(360px, calc(100vh - 200px), 860px)" }}
                          >
                            <canvas ref={(el) => (canvasEl = el)} />
                          </Box>
                        </Box>
                      )}
                    </Show>
                  </Suspense>

                  <Stack gap="3">
                    <Box borderWidth="1px" borderColor="border" borderRadius="l3" p="3">
                      <Stack gap="2">
                        <Heading as="h2" fontSize="sm">
                          Run Metadata
                        </Heading>
                        <Grid
                          gridTemplateColumns="auto 1fr"
                          columnGap="3"
                          rowGap="2"
                          alignItems="start"
                        >
                          <Text textStyle="xs" color="fg.subtle">
                            ID
                          </Text>
                          <Text textStyle="xs" fontFamily="mono" lineBreak="anywhere">
                            {m().id}
                          </Text>
                          <Text textStyle="xs" color="fg.subtle">
                            Embedding run
                          </Text>
                          <Link href={`/embeddings/${m().embeddingRunId}`}>
                            {m().embeddingRunId}
                          </Link>
                          <Text textStyle="xs" color="fg.subtle">
                            Created
                          </Text>
                          <Text textStyle="sm" color="fg.muted">
                            {new Date(m().createdAt).toLocaleString()}
                          </Text>
                          <Text textStyle="xs" color="fg.subtle">
                            Model artifact
                          </Text>
                          <Show
                            when={m().artifactPath}
                            fallback={
                              <Text textStyle="sm" color="fg.muted">
                                Not available
                              </Text>
                            }
                          >
                            <Text textStyle="xs" fontFamily="mono" lineBreak="anywhere">
                              {m().artifactPath}
                            </Text>
                          </Show>
                        </Grid>
                      </Stack>
                    </Box>

                    <Box borderWidth="1px" borderColor="border" borderRadius="l3" p="3">
                      <Stack gap="2">
                        <Flex align="center" justify="space-between" gap="3">
                          <Heading as="h2" fontSize="sm">
                            Training Params
                          </Heading>
                          <Badge colorPalette="gray">{paramEntries.length}</Badge>
                        </Flex>
                        <Show
                          when={paramEntries.length > 0}
                          fallback={
                            <Text textStyle="sm" color="fg.muted">
                              No training parameters were recorded.
                            </Text>
                          }
                        >
                          <Box maxH={{ base: "none", xl: "calc(100vh - 360px)" }} overflowY="auto">
                            <Stack gap="0">
                              <For each={paramEntries}>
                                {([key, value]) => (
                                  <Grid
                                    gridTemplateColumns="minmax(0, 1fr) minmax(0, 1.3fr)"
                                    gap="3"
                                    py="2"
                                    borderTopWidth="1px"
                                    borderColor="border"
                                    alignItems="start"
                                  >
                                    <Text
                                      textStyle="xs"
                                      fontFamily="mono"
                                      color="fg.subtle"
                                      lineBreak="anywhere"
                                    >
                                      {key}
                                    </Text>
                                    <Text textStyle="xs" lineBreak="anywhere">
                                      {formatParamValue(value)}
                                    </Text>
                                  </Grid>
                                )}
                              </For>
                            </Stack>
                          </Box>
                        </Show>
                      </Stack>
                    </Box>

                  </Stack>
                </Grid>
              );
            }}
          </Show>
        </Suspense>
      </Container>
    </Box>
  );
};

export default UmapDetail;
