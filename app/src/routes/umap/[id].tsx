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
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import * as Table from "~/components/ui/table";
import { Box, Container, Flex, Stack } from "styled-system/jsx";
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
};

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
      <Container py="4" px="4" maxW="1200px">
        <Stack gap="6">
          <Flex align="center" justify="space-between" gap="4" flexWrap="wrap">
            <Stack gap="1">
              <Heading as="h1" fontSize="2xl">
                UMAP Run
              </Heading>
              <Suspense
                fallback={
                  <Text textStyle="sm" color="fg.muted">
                    Loading…
                  </Text>
                }
              >
                <Show when={meta()}>
                  {(m) => (
                    <Stack gap="1" fontSize="sm" color="fg.muted">
                      <Box>
                        <Box as="span" fontWeight="semibold" color="fg.default">
                          ID:
                        </Box>{" "}
                        {m().id}
                      </Box>
                      <Box>
                        <Box as="span" fontWeight="semibold" color="fg.default">
                          Dims:
                        </Box>{" "}
                        {m().dims}D
                      </Box>
                      <Box>
                        <Box as="span" fontWeight="semibold" color="fg.default">
                          Embedding Run:
                        </Box>{" "}
                        <Link href={`/embeddings/${m().embeddingRunId}`}>
                          {m().embeddingRunId.slice(0, 10)}
                        </Link>
                      </Box>
                      <Box>
                        <Box as="span" fontWeight="semibold" color="fg.default">
                          Created:
                        </Box>{" "}
                        {new Date(m().createdAt).toLocaleString()}
                      </Box>

                      <Box pt="2">
                        <Box
                          as="span"
                          fontWeight="semibold"
                          color="fg.default"
                        >
                          Params:
                        </Box>
                        <Show
                          when={m().params && Object.keys(m().params || {}).length > 0}
                          fallback={
                            <Box as="span" ml="1" color="fg.subtle">
                              (none)
                            </Box>
                          }
                        >
                          <Box
                            mt="2"
                            borderWidth="1px"
                            borderColor="border"
                            borderRadius="l2"
                            overflow="hidden"
                          >
                            <Table.Root>
                              <Table.Head>
                                <Table.Row>
                                  <Table.Header textAlign="left">
                                    Key
                                  </Table.Header>
                                  <Table.Header textAlign="left">
                                    Value
                                  </Table.Header>
                                </Table.Row>
                              </Table.Head>
                              <Table.Body>
                                <For
                                  each={Object.entries(
                                    (m().params as Record<string, unknown>) || {}
                                  )}
                                >
                                  {([k, v]) => (
                                    <Table.Row>
                                      <Table.Cell fontFamily="mono" fontSize="xs">
                                        {k}
                                      </Table.Cell>
                                      <Table.Cell fontSize="xs">
                                        {typeof v === "object"
                                          ? JSON.stringify(v)
                                          : String(v)}
                                      </Table.Cell>
                                    </Table.Row>
                                  )}
                                </For>
                              </Table.Body>
                            </Table.Root>
                          </Box>
                        </Show>
                      </Box>
                    </Stack>
                  )}
                </Show>
              </Suspense>
            </Stack>

            <Button
              size="sm"
              variant="solid"
              colorPalette="red"
              loading={busy()}
              onClick={handleDelete}
            >
              Delete Run
            </Button>
          </Flex>

          <Suspense
            fallback={
              <Text textStyle="sm" color="fg.muted">
                Loading points…
              </Text>
            }
          >
            <Show when={data()}>
              {(d) => (
                <Stack gap="4">
                  <Box
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="l2"
                    overflow="hidden"
                  >
                    <Flex
                      align="center"
                      justify="space-between"
                      px="3"
                      py="2"
                    >
                      <Text textStyle="sm" color="fg.muted">
                        {d().points.length} points ({d().dims}D)
                      </Text>
                      <Button size="xs" variant="outline" onClick={refreshPoints}>
                        Refresh
                      </Button>
                    </Flex>

                    <Box
                      ref={(el) => (canvasContainerEl = el)}
                      w="full"
                      style={{ height: "360px" }}
                    >
                      <canvas ref={(el) => (canvasEl = el)} />
                    </Box>
                  </Box>

                  <Box
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="l2"
                    overflow="hidden"
                  >
                    <Table.Root>
                      <Table.Head>
                        <Table.Row>
                          <Table.Header textAlign="left">Doc</Table.Header>
                          <Table.Header textAlign="left">x</Table.Header>
                          <Table.Header textAlign="left">y</Table.Header>
                          <Table.Header textAlign="left">z</Table.Header>
                        </Table.Row>
                      </Table.Head>
                      <Table.Body>
                        <For each={d().points.slice(0, 50)}>
                          {(p) => (
                            <Table.Row>
                              <Table.Cell fontFamily="mono" fontSize="xs">
                                <Link href={`/docs/${p.docId}`}>
                                  {p.docId.slice(0, 10)}
                                </Link>
                              </Table.Cell>
                              <Table.Cell>{p.x.toFixed(2)}</Table.Cell>
                              <Table.Cell>{p.y.toFixed(2)}</Table.Cell>
                              <Table.Cell>
                                {p.z != null ? p.z.toFixed(2) : "-"}
                              </Table.Cell>
                            </Table.Row>
                          )}
                        </For>
                      </Table.Body>
                    </Table.Root>
                    <Box px="3" py="2">
                      <Text textStyle="xs" color="fg.muted">
                        Showing first 50 points.
                      </Text>
                    </Box>
                  </Box>
                </Stack>
              )}
            </Show>
          </Suspense>

          <Link href="/umap">← Back to UMAP</Link>
        </Stack>
      </Container>
    </Box>
  );
};

export default UmapDetail;
