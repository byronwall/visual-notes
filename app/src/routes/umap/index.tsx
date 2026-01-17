import {
  type VoidComponent,
  For,
  Show,
  Suspense,
  createResource,
} from "solid-js";
import { createStore } from "solid-js/store";
import { Portal } from "solid-js/web";
import { apiFetch } from "~/utils/base-url";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";
import { Link } from "~/components/ui/link";
import * as Select from "~/components/ui/select";
import * as Table from "~/components/ui/table";
import { Box, Container, Flex, Grid, HStack, Stack } from "styled-system/jsx";

type UmapRun = {
  id: string;
  dims: number;
  params: Record<string, unknown> | null;
  embeddingRunId: string;
  createdAt: string;
};

type EmbeddingRun = { id: string };

async function listUmapRuns(): Promise<UmapRun[]> {
  const res = await apiFetch("/api/umap/runs");
  if (!res.ok) throw new Error("Failed to load UMAP runs");
  const json = (await res.json()) as { runs: UmapRun[] };
  return json.runs || [];
}

async function listEmbeddingRuns(): Promise<EmbeddingRun[]> {
  const res = await apiFetch("/api/embeddings/runs");
  if (!res.ok) throw new Error("Failed to load embedding runs");
  const json = (await res.json()) as { runs: EmbeddingRun[] };
  return json.runs || [];
}

async function triggerUmapRun(
  embeddingRunId: string,
  dims: 2 | 3,
  params?: Record<string, unknown>
) {
  const res = await apiFetch(`/api/umap/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeddingRunId, dims, params }),
  });
  if (!res.ok)
    throw new Error((await res.json()).error || "Failed to create UMAP run");
  return (await res.json()) as { runId: string };
}

type SelectItem = { label: string; value: string };

const DIMS_ITEMS: SelectItem[] = [
  { label: "2D", value: "2" },
  { label: "3D", value: "3" },
];

const METRIC_ITEMS: SelectItem[] = [
  { label: "cosine", value: "cosine" },
  { label: "euclidean", value: "euclidean" },
];

const INIT_ITEMS: SelectItem[] = [
  { label: "spectral", value: "spectral" },
  { label: "random", value: "random" },
];

function parseMetric(v: string): "cosine" | "euclidean" {
  return v === "euclidean" ? "euclidean" : "cosine";
}

function parseInit(v: string): "random" | "spectral" {
  return v === "random" ? "random" : "spectral";
}

function asString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

function parseNumberOrUndefined(v: string): number | undefined {
  const trimmed = v.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function parseIntOrUndefined(v: string): number | undefined {
  const trimmed = v.trim();
  if (trimmed === "") return undefined;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : undefined;
}

const UmapIndex: VoidComponent = () => {
  const [runs, { refetch }] = createResource(listUmapRuns);
  const [embeddingRuns] = createResource(listEmbeddingRuns);
  const [state, setState] = createStore({
    creating: false,
    selectedEmbedding: "",
    dims: 2 as 2 | 3,
    pcaVarsToKeep: "50",
    nNeighbors: "15",
    minDist: "0.1",
    metric: "cosine" as "cosine" | "euclidean",
    learningRate: "",
    nEpochs: "",
    localConnectivity: "",
    repulsionStrength: "",
    negativeSampleRate: "",
    setOpMixRatio: "",
    spread: "",
    init: "spectral" as "random" | "spectral",
  });

  const cloneRunToInputs = (r: UmapRun) => {
    console.log("[UmapIndex] cloneRunToInputs", { id: r.id });

    const p = (r.params ?? {}) as Record<string, unknown>;

    setState({
      selectedEmbedding: r.embeddingRunId,
      dims: r.dims === 3 ? 3 : 2,

      // Defaults
      pcaVarsToKeep: "50",
      nNeighbors: "15",
      minDist: "0.1",
      metric: "cosine",
      learningRate: "",
      nEpochs: "",
      localConnectivity: "",
      repulsionStrength: "",
      negativeSampleRate: "",
      setOpMixRatio: "",
      spread: "",
      init: "spectral",
    });

    const pca = asString(p.pcaVarsToKeep);
    const nn = asString(p.nNeighbors);
    const md = asString(p.minDist);
    const lr = asString(p.learningRate);
    const ne = asString(p.nEpochs);
    const lc = asString(p.localConnectivity);
    const rs = asString(p.repulsionStrength);
    const nsr = asString(p.negativeSampleRate);
    const somr = asString(p.setOpMixRatio);
    const sp = asString(p.spread);
    const metric = asString(p.metric);
    const init = asString(p.init);

    setState((prev) => ({
      ...prev,
      pcaVarsToKeep: pca ?? prev.pcaVarsToKeep,
      nNeighbors: nn ?? prev.nNeighbors,
      minDist: md ?? prev.minDist,
      metric: parseMetric(metric ?? prev.metric),
      learningRate: lr ?? prev.learningRate,
      nEpochs: ne ?? prev.nEpochs,
      localConnectivity: lc ?? prev.localConnectivity,
      repulsionStrength: rs ?? prev.repulsionStrength,
      negativeSampleRate: nsr ?? prev.negativeSampleRate,
      setOpMixRatio: somr ?? prev.setOpMixRatio,
      spread: sp ?? prev.spread,
      init: parseInit(init ?? prev.init),
    }));
  };

  const embeddingSelectCollection = () => {
    const items: SelectItem[] =
      embeddingRuns()?.map((r) => ({
        label: r.id.slice(0, 10),
        value: r.id,
      })) ?? [];
    return Select.createListCollection<SelectItem>({ items });
  };

  const embeddingSelectItems = () => embeddingSelectCollection().items;

  const handleCreateRun = async () => {
    if (!state.selectedEmbedding) return;

    setState("creating", true);
    try {
      const params: Record<string, unknown> = {};
      const pca = parseIntOrUndefined(state.pcaVarsToKeep);
      const nn = parseIntOrUndefined(state.nNeighbors);
      const md = parseNumberOrUndefined(state.minDist);

      if (pca !== undefined) params.pcaVarsToKeep = pca;
      if (nn !== undefined) params.nNeighbors = nn;
      if (md !== undefined) params.minDist = md;
      params.metric = state.metric;

      const lr = parseNumberOrUndefined(state.learningRate);
      if (lr !== undefined) params.learningRate = lr;

      const ne = parseIntOrUndefined(state.nEpochs);
      if (ne !== undefined) params.nEpochs = ne;

      const lc = parseIntOrUndefined(state.localConnectivity);
      if (lc !== undefined) params.localConnectivity = lc;

      const rs = parseNumberOrUndefined(state.repulsionStrength);
      if (rs !== undefined) params.repulsionStrength = rs;

      const nsr = parseIntOrUndefined(state.negativeSampleRate);
      if (nsr !== undefined) params.negativeSampleRate = nsr;

      const somr = parseNumberOrUndefined(state.setOpMixRatio);
      if (somr !== undefined) params.setOpMixRatio = somr;

      const sp = parseNumberOrUndefined(state.spread);
      if (sp !== undefined) params.spread = sp;

      params.init = state.init;

      console.log("[UmapIndex] createRun", {
        embeddingRunId: state.selectedEmbedding,
        dims: state.dims,
        params,
      });

      await triggerUmapRun(state.selectedEmbedding, state.dims, params);
      await refetch();
    } catch (e) {
      console.error(e);
      alert("Failed to start UMAP run");
    } finally {
      setState("creating", false);
    }
  };

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container py="4" px="4" maxW="1200px">
        <Stack gap="6">
          <Flex align="center" justify="space-between" gap="4" flexWrap="wrap">
            <Heading as="h1" fontSize="2xl">
              UMAP
            </Heading>

            <Suspense fallback={null}>
              <HStack gap="3" flexWrap="wrap">
                <Select.Root<SelectItem>
                  collection={embeddingSelectCollection()}
                  value={state.selectedEmbedding ? [state.selectedEmbedding] : []}
                  onValueChange={(details) =>
                    setState("selectedEmbedding", details.value[0] ?? "")
                  }
                  positioning={{ sameWidth: true }}
                >
                  <Select.Control>
                    <Select.Trigger minW="260px">
                      <Select.ValueText placeholder="Select embedding run…" />
                      <Select.Indicator />
                    </Select.Trigger>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content>
                        <Select.List>
                          <For each={embeddingSelectItems()}>
                            {(item) => (
                              <Select.Item item={item}>
                                <Select.ItemText>{item.label}</Select.ItemText>
                                <Select.ItemIndicator />
                              </Select.Item>
                            )}
                          </For>
                        </Select.List>
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                  <Select.HiddenSelect />
                </Select.Root>

                <Select.Root<SelectItem>
                  collection={Select.createListCollection<SelectItem>({
                    items: DIMS_ITEMS,
                  })}
                  value={[String(state.dims)]}
                  onValueChange={(details) =>
                    setState(
                      "dims",
                      details.value[0] === "3" ? 3 : (2 as 2 | 3)
                    )
                  }
                  positioning={{ sameWidth: true }}
                >
                  <Select.Control>
                    <Select.Trigger w="96px">
                      <Select.ValueText placeholder="Dims" />
                      <Select.Indicator />
                    </Select.Trigger>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content>
                        <Select.List>
                          <For each={DIMS_ITEMS}>
                            {(item) => (
                              <Select.Item item={item}>
                                <Select.ItemText>{item.label}</Select.ItemText>
                                <Select.ItemIndicator />
                              </Select.Item>
                            )}
                          </For>
                        </Select.List>
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                  <Select.HiddenSelect />
                </Select.Root>

                <Button
                  size="sm"
                  variant="solid"
                  colorPalette="green"
                  loading={state.creating}
                  disabled={!state.selectedEmbedding}
                  onClick={handleCreateRun}
                >
                  Create Run
                </Button>
              </HStack>
            </Suspense>
          </Flex>

          <Box
            borderWidth="1px"
            borderColor="border"
            borderRadius="l2"
            bg="bg.default"
            p="3"
          >
            <Stack gap="3">
              <Heading as="h2" fontSize="sm">
                UMAP Parameters
              </Heading>

              <Grid
                gridTemplateColumns={{
                  base: "1fr",
                  md: "repeat(3, minmax(0, 1fr))",
                }}
                gap="3"
              >
                <Stack gap="1">
                  <Box as="label" fontSize="xs" color="fg.muted">
                    PCA variables to keep
                  </Box>
                  <Input
                    type="number"
                    min="1"
                    value={state.pcaVarsToKeep}
                    placeholder="50"
                    onInput={(e) =>
                      setState("pcaVarsToKeep", e.currentTarget.value)
                    }
                  />
                </Stack>

                <Stack gap="1">
                  <Box as="label" fontSize="xs" color="fg.muted">
                    nNeighbors
                  </Box>
                  <Input
                    type="number"
                    min="2"
                    max="200"
                    value={state.nNeighbors}
                    placeholder="15"
                    onInput={(e) => setState("nNeighbors", e.currentTarget.value)}
                  />
                </Stack>

                <Stack gap="1">
                  <Box as="label" fontSize="xs" color="fg.muted">
                    minDist
                  </Box>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={state.minDist}
                    placeholder="0.1"
                    onInput={(e) => setState("minDist", e.currentTarget.value)}
                  />
                </Stack>

                <Stack gap="1">
                  <Box as="label" fontSize="xs" color="fg.muted">
                    metric
                  </Box>
                  <Select.Root<SelectItem>
                    collection={Select.createListCollection<SelectItem>({
                      items: METRIC_ITEMS,
                    })}
                    value={[state.metric]}
                    onValueChange={(details) =>
                      setState("metric", parseMetric(details.value[0] ?? ""))
                    }
                    positioning={{ sameWidth: true }}
                  >
                    <Select.Control>
                      <Select.Trigger>
                        <Select.ValueText placeholder="metric" />
                        <Select.Indicator />
                      </Select.Trigger>
                    </Select.Control>
                    <Portal>
                      <Select.Positioner>
                        <Select.Content>
                          <Select.List>
                            <For each={METRIC_ITEMS}>
                              {(item) => (
                                <Select.Item item={item}>
                                  <Select.ItemText>
                                    {item.label}
                                  </Select.ItemText>
                                  <Select.ItemIndicator />
                                </Select.Item>
                              )}
                            </For>
                          </Select.List>
                        </Select.Content>
                      </Select.Positioner>
                    </Portal>
                    <Select.HiddenSelect />
                  </Select.Root>
                </Stack>

                <Stack gap="1">
                  <Box as="label" fontSize="xs" color="fg.muted">
                    learningRate (optional)
                  </Box>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={state.learningRate}
                    placeholder="1.0"
                    onInput={(e) =>
                      setState("learningRate", e.currentTarget.value)
                    }
                  />
                </Stack>

                <Stack gap="1">
                  <Box as="label" fontSize="xs" color="fg.muted">
                    nEpochs (optional)
                  </Box>
                  <Input
                    type="number"
                    min="1"
                    value={state.nEpochs}
                    placeholder="200"
                    onInput={(e) => setState("nEpochs", e.currentTarget.value)}
                  />
                </Stack>

                <Stack gap="1">
                  <Box as="label" fontSize="xs" color="fg.muted">
                    localConnectivity (optional)
                  </Box>
                  <Input
                    type="number"
                    min="1"
                    value={state.localConnectivity}
                    placeholder="1"
                    onInput={(e) =>
                      setState("localConnectivity", e.currentTarget.value)
                    }
                  />
                </Stack>

                <Stack gap="1">
                  <Box as="label" fontSize="xs" color="fg.muted">
                    repulsionStrength (optional)
                  </Box>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={state.repulsionStrength}
                    placeholder="1.0"
                    onInput={(e) =>
                      setState("repulsionStrength", e.currentTarget.value)
                    }
                  />
                </Stack>

                <Stack gap="1">
                  <Box as="label" fontSize="xs" color="fg.muted">
                    negativeSampleRate (optional)
                  </Box>
                  <Input
                    type="number"
                    min="1"
                    value={state.negativeSampleRate}
                    placeholder="5"
                    onInput={(e) =>
                      setState("negativeSampleRate", e.currentTarget.value)
                    }
                  />
                </Stack>

                <Stack gap="1">
                  <Box as="label" fontSize="xs" color="fg.muted">
                    setOpMixRatio (optional)
                  </Box>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={state.setOpMixRatio}
                    placeholder="1.0"
                    onInput={(e) =>
                      setState("setOpMixRatio", e.currentTarget.value)
                    }
                  />
                </Stack>

                <Stack gap="1">
                  <Box as="label" fontSize="xs" color="fg.muted">
                    spread (optional)
                  </Box>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={state.spread}
                    placeholder="1.0"
                    onInput={(e) => setState("spread", e.currentTarget.value)}
                  />
                </Stack>

                <Stack gap="1">
                  <Box as="label" fontSize="xs" color="fg.muted">
                    init
                  </Box>
                  <Select.Root<SelectItem>
                    collection={Select.createListCollection<SelectItem>({
                      items: INIT_ITEMS,
                    })}
                    value={[state.init]}
                    onValueChange={(details) =>
                      setState("init", parseInit(details.value[0] ?? ""))
                    }
                    positioning={{ sameWidth: true }}
                  >
                    <Select.Control>
                      <Select.Trigger>
                        <Select.ValueText placeholder="init" />
                        <Select.Indicator />
                      </Select.Trigger>
                    </Select.Control>
                    <Portal>
                      <Select.Positioner>
                        <Select.Content>
                          <Select.List>
                            <For each={INIT_ITEMS}>
                              {(item) => (
                                <Select.Item item={item}>
                                  <Select.ItemText>
                                    {item.label}
                                  </Select.ItemText>
                                  <Select.ItemIndicator />
                                </Select.Item>
                              )}
                            </For>
                          </Select.List>
                        </Select.Content>
                      </Select.Positioner>
                    </Portal>
                    <Select.HiddenSelect />
                  </Select.Root>
                </Stack>
              </Grid>
            </Stack>
          </Box>

          <Suspense
            fallback={
              <Box fontSize="sm" color="fg.muted">
                Loading…
              </Box>
            }
          >
            <Show when={runs()}>
              {(items) => (
                <Box
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="l2"
                  overflow="hidden"
                >
                  <Table.Root>
                    <Table.Head>
                      <Table.Row>
                        <Table.Header textAlign="left">Run</Table.Header>
                        <Table.Header textAlign="left">Dims</Table.Header>
                        <Table.Header textAlign="left">Embedding</Table.Header>
                        <Table.Header textAlign="left">Created</Table.Header>
                        <Table.Header textAlign="left">Clone</Table.Header>
                        <Table.Header textAlign="right">Actions</Table.Header>
                      </Table.Row>
                    </Table.Head>
                    <Table.Body>
                      <For each={items()}>
                        {(r) => (
                          <Table.Row>
                            <Table.Cell>
                              <Link href={`/umap/${r.id}`}>
                                {r.id.slice(0, 8)}
                              </Link>
                            </Table.Cell>
                            <Table.Cell>{r.dims}D</Table.Cell>
                            <Table.Cell>
                              <Link href={`/embeddings/${r.embeddingRunId}`}>
                                {r.embeddingRunId.slice(0, 8)}
                              </Link>
                            </Table.Cell>
                            <Table.Cell>
                              {new Date(r.createdAt).toLocaleString()}
                            </Table.Cell>
                            <Table.Cell>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => cloneRunToInputs(r)}
                              >
                                Clone
                              </Button>
                            </Table.Cell>
                            <Table.Cell textAlign="right">
                              <Link href={`/umap/${r.id}`}>View</Link>
                            </Table.Cell>
                          </Table.Row>
                        )}
                      </For>
                    </Table.Body>
                  </Table.Root>
                </Box>
              )}
            </Show>
          </Suspense>
        </Stack>
      </Container>
    </Box>
  );
};

export default UmapIndex;
