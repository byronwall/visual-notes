import { type VoidComponent, createEffect, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import { createAsync, revalidate, useAction } from "@solidjs/router";
import { Box, Container, Stack } from "styled-system/jsx";
import { fetchEmbeddingRuns } from "~/services/embeddings/embeddings.queries";
import { fetchJobStatus } from "~/services/jobs/jobs.queries";
import { fetchUmapRuns } from "~/services/umap/umap.queries";
import { createUmapRun } from "~/services/umap/umap.actions";
import { UmapCreateToolbar } from "~/features/umap/UmapCreateToolbar";
import { UmapWorkflowCard } from "~/features/umap/UmapWorkflowCard";
import { UmapJobStatusCard } from "~/features/umap/UmapJobStatusCard";
import { UmapParamsCard } from "~/features/umap/UmapParamsCard";
import { UmapRunsTable } from "~/features/umap/UmapRunsTable";
import {
  asString,
  parseInit,
  parseIntOrUndefined,
  parseMetric,
  parseNumberOrUndefined,
} from "~/features/umap/format";
import type { UmapFormState, UmapRun } from "~/features/umap/types";

const defaultFormState: UmapFormState = {
  creating: false,
  showAdvanced: false,
  selectedEmbedding: "",
  dims: 2,
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
  activeJobId: "",
};

const UmapIndex: VoidComponent = () => {
  const runs = createAsync(() => fetchUmapRuns());
  const embeddingRuns = createAsync(() => fetchEmbeddingRuns());
  const runCreateUmap = useAction(createUmapRun);

  const [state, setState] = createStore<UmapFormState>(defaultFormState);

  const activeJob = createAsync(() => {
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

  const embeddingSelectItems = () =>
    embeddingRuns()?.map((run) => ({
      label: run.id.slice(0, 10),
      value: run.id,
    })) ?? [];

  const cloneRunToInputs = (run: UmapRun) => {
    console.log("[UmapIndex] cloneRunToInputs", { id: run.id });

    const params = (run.params ?? {}) as Record<string, unknown>;

    setState({
      selectedEmbedding: run.embeddingRunId,
      dims: run.dims === 3 ? 3 : 2,
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

    const pca = asString(params.pcaVarsToKeep);
    const neighbors = asString(params.nNeighbors);
    const minDist = asString(params.minDist);
    const learningRate = asString(params.learningRate);
    const nEpochs = asString(params.nEpochs);
    const localConnectivity = asString(params.localConnectivity);
    const repulsionStrength = asString(params.repulsionStrength);
    const negativeSampleRate = asString(params.negativeSampleRate);
    const setOpMixRatio = asString(params.setOpMixRatio);
    const spread = asString(params.spread);
    const metric = asString(params.metric);
    const init = asString(params.init);

    setState((prev) => ({
      ...prev,
      pcaVarsToKeep: pca ?? prev.pcaVarsToKeep,
      nNeighbors: neighbors ?? prev.nNeighbors,
      minDist: minDist ?? prev.minDist,
      metric: parseMetric(metric ?? prev.metric),
      learningRate: learningRate ?? prev.learningRate,
      nEpochs: nEpochs ?? prev.nEpochs,
      localConnectivity: localConnectivity ?? prev.localConnectivity,
      repulsionStrength: repulsionStrength ?? prev.repulsionStrength,
      negativeSampleRate: negativeSampleRate ?? prev.negativeSampleRate,
      setOpMixRatio: setOpMixRatio ?? prev.setOpMixRatio,
      spread: spread ?? prev.spread,
      init: parseInit(init ?? prev.init),
    }));
  };

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
      const neighbors = parseIntOrUndefined(state.nNeighbors);
      const minDist = parseNumberOrUndefined(state.minDist);
      const learningRate = parseNumberOrUndefined(state.learningRate);
      const nEpochs = parseIntOrUndefined(state.nEpochs);
      const localConnectivity = parseIntOrUndefined(state.localConnectivity);
      const repulsionStrength = parseNumberOrUndefined(state.repulsionStrength);
      const negativeSampleRate = parseIntOrUndefined(state.negativeSampleRate);
      const setOpMixRatio = parseNumberOrUndefined(state.setOpMixRatio);
      const spread = parseNumberOrUndefined(state.spread);

      if (pca !== undefined) params.pcaVarsToKeep = pca;
      if (neighbors !== undefined) params.nNeighbors = neighbors;
      if (minDist !== undefined) params.minDist = minDist;
      if (learningRate !== undefined) params.learningRate = learningRate;
      if (nEpochs !== undefined) params.nEpochs = nEpochs;
      if (localConnectivity !== undefined) params.localConnectivity = localConnectivity;
      if (repulsionStrength !== undefined) params.repulsionStrength = repulsionStrength;
      if (negativeSampleRate !== undefined) params.negativeSampleRate = negativeSampleRate;
      if (setOpMixRatio !== undefined) params.setOpMixRatio = setOpMixRatio;
      if (spread !== undefined) params.spread = spread;

      params.metric = state.metric;
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
    } catch (error) {
      console.error(error);
      alert("Failed to start UMAP run");
    } finally {
      setState("creating", false);
      setState("activeJobId", "");
    }
  };

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container py="4" px="4" maxW="1200px">
        <Stack gap="6">
          <UmapCreateToolbar
            embeddingItems={embeddingSelectItems()}
            selectedEmbedding={state.selectedEmbedding}
            dims={state.dims}
            creating={state.creating}
            onSelectedEmbeddingChange={(value) => setState("selectedEmbedding", value)}
            onDimsChange={(value) => setState("dims", value)}
            onCreateRun={handleCreateRun}
          />

          <UmapWorkflowCard />

          <UmapJobStatusCard activeJobId={state.activeJobId} activeJob={activeJob} />

          <UmapParamsCard
            state={state}
            onToggleAdvanced={() => setState("showAdvanced", !state.showAdvanced)}
            onFieldChange={(field, value) => setState(field, value)}
          />

          <UmapRunsTable runs={runs} onClone={cloneRunToInputs} />
        </Stack>
      </Container>
    </Box>
  );
};

export default UmapIndex;
