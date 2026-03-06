import {
  type VoidComponent,
  createEffect,
  For,
  onCleanup,
  Show,
  Suspense,
} from "solid-js";
import { createStore } from "solid-js/store";
import { createAsync, revalidate, useAction } from "@solidjs/router";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import type { SimpleSelectItem } from "~/components/ui/simple-select";
import { SimpleSelect } from "~/components/ui/simple-select";
import * as Table from "~/components/ui/table";
import { Box, Container, Flex, Grid, HStack, Stack } from "styled-system/jsx";
import { fetchEmbeddingRuns } from "~/services/embeddings/embeddings.queries";
import { fetchJobStatus, type JobStatus } from "~/services/jobs/jobs.queries";
import { fetchUmapRuns } from "~/services/umap/umap.queries";
import { createUmapRun } from "~/services/umap/umap.actions";

type UmapRun = {
  id: string;
  dims: number;
  params: Record<string, unknown> | null;
  embeddingRunId: string;
  hasArtifact: boolean;
  createdAt: string;
};

type EmbeddingRun = { id: string };

type SelectItem = SimpleSelectItem;

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
  const runs = createAsync((): Promise<UmapRun[]> => fetchUmapRuns());
  const embeddingRuns = createAsync((): Promise<EmbeddingRun[]> =>
    fetchEmbeddingRuns()
  );
  const runCreateUmap = useAction(createUmapRun);
  const [state, setState] = createStore({
    creating: false,
    showAdvanced: false,
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
    activeJobId: "",
  });
  const activeJob = createAsync((): Promise<JobStatus | null> => {
    if (!state.activeJobId) return Promise.resolve(null);
    return fetchJobStatus(state.activeJobId);
  });

  createEffect(() => {
    const jobId = state.activeJobId;
    if (!jobId || typeof window === "undefined") return;
    const timer = window.setInterval(() => {
      void revalidate(fetchJobStatus.keyFor(jobId));
    }, 1200);
    onCleanup(() => window.clearInterval(timer));
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

  const embeddingSelectItems = () =>
    embeddingRuns()?.map((r) => ({
      label: r.id.slice(0, 10),
      value: r.id,
    })) ?? [];

  const handleCreateRun = async () => {
    if (!state.selectedEmbedding) return;

    setState("creating", true);
    const jobId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `umap-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setState("activeJobId", jobId);
    await revalidate(fetchJobStatus.keyFor(jobId));

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

      await runCreateUmap({
        embeddingRunId: state.selectedEmbedding,
        jobId,
        dims: state.dims,
        params,
      });
      await revalidate(fetchUmapRuns.key);
    } catch (e) {
      console.error(e);
      alert("Failed to start UMAP run");
    } finally {
      setState("creating", false);
      setState("activeJobId", "");
    }
  };

  const toggleAdvanced = () => {
    setState("showAdvanced", !state.showAdvanced);
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
                <SimpleSelect
                  items={embeddingSelectItems()}
                  value={state.selectedEmbedding ?? ""}
                  onChange={(value) => setState("selectedEmbedding", value)}
                  sameWidth
                  minW="260px"
                  placeholder="Select embedding run…"
                />

                <SimpleSelect
                  items={DIMS_ITEMS}
                  value={String(state.dims)}
                  onChange={(value) =>
                    setState("dims", value === "3" ? 3 : (2 as 2 | 3))
                  }
                  sameWidth
                  minW="96px"
                  placeholder="Dims"
                />

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

          <Box borderWidth="1px" borderColor="border" borderRadius="l2" p="3">
            <Stack gap="2">
              <Heading as="h2" fontSize="sm">
                Projection Workflow
              </Heading>
              <Text textStyle="sm" color="fg.muted">
                1) Pick an embedding run and train UMAP once on this page.
              </Text>
              <Text textStyle="sm" color="fg.muted">
                2) New or updated docs are embedded from the Embedding Run page.
              </Text>
              <Text textStyle="sm" color="fg.muted">
                3) Fresh vectors are projected into trained UMAP models without retraining.
              </Text>
            </Stack>
          </Box>

          <Show when={state.activeJobId}>
            <Suspense fallback={null}>
              <Show when={activeJob()}>
                {(job) => (
                  <Box
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="l2"
                    bg="bg.default"
                    p="3"
                  >
                    <Stack gap="2">
                      <Flex align="center" justify="space-between" gap="3">
                        <Box fontSize="sm" fontWeight="medium">
                          {job().typeLabel}
                        </Box>
                        <Box fontSize="xs" color="fg.muted">
                          {job().stageLabel} • {job().progress}%
                        </Box>
                      </Flex>
                      <Box
                        h="2"
                        w="full"
                        bg="bg.muted"
                        borderRadius="full"
                        overflow="hidden"
                      >
                        <Box
                          h="full"
                          bg={job().stage === "failed" ? "red.500" : "green.500"}
                          style={{
                            width: `${Math.max(0, Math.min(100, job().progress))}%`,
                            transition: "width 180ms ease",
                          }}
                        />
                      </Box>
                      <Show when={job().error}>
                        <Box fontSize="xs" color="red.600">
                          {job().error}
                        </Box>
                      </Show>
                    </Stack>
                  </Box>
                )}
              </Show>
            </Suspense>
          </Show>

          <Box
            borderWidth="1px"
            borderColor="border"
            borderRadius="l2"
            bg="bg.default"
            p="3"
          >
            <Stack gap="3">
              <Flex align="center" justify="space-between" gap="3" flexWrap="wrap">
                <Heading as="h2" fontSize="sm">
                  UMAP Parameters
                </Heading>
                <Button size="xs" variant="outline" onClick={toggleAdvanced}>
                  <Show when={state.showAdvanced} fallback={"Advanced"}>
                    Hide Advanced
                  </Show>
                </Button>
              </Flex>

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
                    onInput={(e) =>
                      setState("nNeighbors", e.currentTarget.value)
                    }
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
                  <SimpleSelect
                    items={METRIC_ITEMS}
                    value={state.metric}
                    onChange={(value) => setState("metric", parseMetric(value))}
                    label="metric"
                    labelProps={{ fontSize: "xs", color: "fg.muted" }}
                    sameWidth
                    placeholder="metric"
                  />
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

                <Show when={!state.showAdvanced}>
                  <Stack gap="1">
                    <SimpleSelect
                      items={INIT_ITEMS}
                      value={state.init}
                      onChange={(value) => setState("init", parseInit(value))}
                      label="init"
                      labelProps={{ fontSize: "xs", color: "fg.muted" }}
                      sameWidth
                      placeholder="init"
                    />
                  </Stack>
                </Show>
              </Grid>

              <Show when={state.showAdvanced}>
                <Grid
                  gridTemplateColumns={{
                    base: "1fr",
                    md: "repeat(3, minmax(0, 1fr))",
                  }}
                  gap="3"
                >
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
                    <SimpleSelect
                      items={INIT_ITEMS}
                      value={state.init}
                      onChange={(value) => setState("init", parseInit(value))}
                      label="init"
                      labelProps={{ fontSize: "xs", color: "fg.muted" }}
                      sameWidth
                      placeholder="init"
                    />
                  </Stack>
                </Grid>
              </Show>
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
                        <Table.Header textAlign="left">Model</Table.Header>
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
                              <Text textStyle="sm" color="fg.muted">
                                {r.hasArtifact ? "Trained" : "Missing"}
                              </Text>
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
