import {
  type VoidComponent,
  For,
  Show,
  createResource,
  createSignal,
} from "solid-js";
import { A } from "@solidjs/router";
import { apiFetch } from "~/utils/base-url";

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

const UmapIndex: VoidComponent = () => {
  const [runs, { refetch }] = createResource(listUmapRuns);
  const [embeddingRuns] = createResource(listEmbeddingRuns);
  const [creating, setCreating] = createSignal(false);
  const [selectedEmbedding, setSelectedEmbedding] = createSignal("");
  const [dims, setDims] = createSignal<2 | 3>(2);
  // UMAP parameter controls
  const [pcaVarsToKeep, setPcaVarsToKeep] = createSignal("50");
  const [nNeighbors, setNNeighbors] = createSignal("15");
  const [minDist, setMinDist] = createSignal("0.1");
  const [metric, setMetric] = createSignal<"cosine" | "euclidean">("cosine");
  const [learningRate, setLearningRate] = createSignal("");
  const [nEpochs, setNEpochs] = createSignal("");
  const [localConnectivity, setLocalConnectivity] = createSignal("");
  const [repulsionStrength, setRepulsionStrength] = createSignal("");
  const [negativeSampleRate, setNegativeSampleRate] = createSignal("");
  const [setOpMixRatio, setSetOpMixRatio] = createSignal("");
  const [spread, setSpread] = createSignal("");
  const [init, setInit] = createSignal<"random" | "spectral">("spectral");

  const cloneRunToInputs = (r: UmapRun) => {
    setSelectedEmbedding(r.embeddingRunId);
    setDims(r.dims === 3 ? 3 : 2);

    // Reset optional fields first
    setPcaVarsToKeep("50");
    setLearningRate("");
    setNEpochs("");
    setLocalConnectivity("");
    setRepulsionStrength("");
    setNegativeSampleRate("");
    setSetOpMixRatio("");
    setSpread("");

    const p = (r.params ?? {}) as any;
    if (p.pcaVarsToKeep !== undefined)
      setPcaVarsToKeep(String(p.pcaVarsToKeep));
    setNNeighbors(p.nNeighbors !== undefined ? String(p.nNeighbors) : "15");
    setMinDist(p.minDist !== undefined ? String(p.minDist) : "0.1");
    setMetric(p.metric === "euclidean" ? "euclidean" : "cosine");
    if (p.learningRate !== undefined) setLearningRate(String(p.learningRate));
    if (p.nEpochs !== undefined) setNEpochs(String(p.nEpochs));
    if (p.localConnectivity !== undefined)
      setLocalConnectivity(String(p.localConnectivity));
    if (p.repulsionStrength !== undefined)
      setRepulsionStrength(String(p.repulsionStrength));
    if (p.negativeSampleRate !== undefined)
      setNegativeSampleRate(String(p.negativeSampleRate));
    if (p.setOpMixRatio !== undefined)
      setSetOpMixRatio(String(p.setOpMixRatio));
    if (p.spread !== undefined) setSpread(String(p.spread));
    setInit(p.init === "random" ? "random" : "spectral");
  };

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4 space-y-6">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold">UMAP</h1>
          <div class="flex items-center gap-2">
            <select
              value={selectedEmbedding()}
              onChange={(e) => setSelectedEmbedding(e.currentTarget.value)}
              class="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="">Select Embedding Run…</option>
              <Show when={embeddingRuns()}>
                {(rs) => (
                  <For each={rs()}>
                    {(r) => <option value={r.id}>{r.id.slice(0, 10)}</option>}
                  </For>
                )}
              </Show>
            </select>
            <select
              value={String(dims())}
              onChange={(e) =>
                setDims(Number(e.currentTarget.value) === 3 ? 3 : 2)
              }
              class="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="2">2D</option>
              <option value="3">3D</option>
            </select>
            <button
              class="cta"
              disabled={creating() || !selectedEmbedding()}
              onClick={async () => {
                try {
                  setCreating(true);
                  const params: Record<string, unknown> = {};
                  // PCA param
                  params.pcaVarsToKeep = Number.parseInt(pcaVarsToKeep());
                  params.nNeighbors = Number.parseInt(nNeighbors());
                  params.minDist = Number(minDist());
                  params.metric = metric();
                  if (learningRate().trim() !== "")
                    params.learningRate = Number(learningRate());
                  if (nEpochs().trim() !== "")
                    params.nEpochs = Number.parseInt(nEpochs());
                  if (localConnectivity().trim() !== "")
                    params.localConnectivity = Number.parseInt(
                      localConnectivity()
                    );
                  if (repulsionStrength().trim() !== "")
                    params.repulsionStrength = Number(repulsionStrength());
                  if (negativeSampleRate().trim() !== "")
                    params.negativeSampleRate = Number.parseInt(
                      negativeSampleRate()
                    );
                  if (setOpMixRatio().trim() !== "")
                    params.setOpMixRatio = Number(setOpMixRatio());
                  if (spread().trim() !== "") params.spread = Number(spread());
                  params.init = init();

                  await triggerUmapRun(selectedEmbedding(), dims(), params);
                  await refetch();
                } catch (e) {
                  console.error(e);
                  alert("Failed to start UMAP run");
                } finally {
                  setCreating(false);
                }
              }}
            >
              {creating() ? "Creating…" : "Create Run"}
            </button>
          </div>
        </div>

        <div class="rounded border border-gray-200 p-3">
          <h2 class="text-sm font-semibold mb-2">UMAP Parameters</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-600">PCA variables to keep</span>
              <div class="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={pcaVarsToKeep()}
                  onInput={(e) => setPcaVarsToKeep(e.currentTarget.value)}
                  placeholder="50"
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <select
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    if (v) setPcaVarsToKeep(v);
                  }}
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">...</option>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                </select>
              </div>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-600">nNeighbors</span>
              <div class="flex gap-2">
                <input
                  type="number"
                  min="2"
                  max="200"
                  value={nNeighbors()}
                  onInput={(e) => setNNeighbors(e.currentTarget.value)}
                  placeholder="15"
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <select
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    if (v) setNNeighbors(v);
                  }}
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">...</option>
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="15">15</option>
                  <option value="75">75</option>
                  <option value="150">150</option>
                </select>
              </div>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-600">minDist</span>
              <div class="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={minDist()}
                  onInput={(e) => setMinDist(e.currentTarget.value)}
                  placeholder="0.1"
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <select
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    if (v) setMinDist(v);
                  }}
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">...</option>
                  <option value="0.01">0.01</option>
                  <option value="0.05">0.05</option>
                  <option value="0.1">0.1</option>
                  <option value="0.5">0.5</option>
                  <option value="0.8">0.8</option>
                </select>
              </div>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-600">metric</span>
              <select
                value={metric()}
                onChange={(e) =>
                  setMetric(
                    e.currentTarget.value === "euclidean"
                      ? "euclidean"
                      : "cosine"
                  )
                }
                class="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="cosine">cosine</option>
                <option value="euclidean">euclidean</option>
              </select>
            </label>

            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-600">learningRate</span>
              <div class="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={learningRate()}
                  onInput={(e) => setLearningRate(e.currentTarget.value)}
                  placeholder="1.0"
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <select
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    if (v) setLearningRate(v);
                  }}
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">...</option>
                  <option value="0.1">0.1</option>
                  <option value="0.5">0.5</option>
                  <option value="1.0">1.0</option>
                  <option value="2.0">2.0</option>
                  <option value="5.0">5.0</option>
                </select>
              </div>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-600">nEpochs</span>
              <div class="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={nEpochs()}
                  onInput={(e) => setNEpochs(e.currentTarget.value)}
                  placeholder="0"
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <select
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    if (v) setNEpochs(v);
                  }}
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">...</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="400">400</option>
                  <option value="800">800</option>
                  <option value="1200">1200</option>
                </select>
              </div>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-600">localConnectivity</span>
              <div class="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={localConnectivity()}
                  onInput={(e) => setLocalConnectivity(e.currentTarget.value)}
                  placeholder="1.0"
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <select
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    if (v) setLocalConnectivity(v);
                  }}
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">...</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="20">20</option>
                </select>
              </div>
            </label>

            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-600">repulsionStrength</span>
              <div class="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={repulsionStrength()}
                  onInput={(e) => setRepulsionStrength(e.currentTarget.value)}
                  placeholder="1.0"
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <select
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    if (v) setRepulsionStrength(v);
                  }}
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">...</option>
                  <option value="0.5">0.5</option>
                  <option value="1.0">1.0</option>
                  <option value="2.0">2.0</option>
                  <option value="3.0">3.0</option>
                  <option value="4.0">4.0</option>
                </select>
              </div>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-600">negativeSampleRate</span>
              <div class="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={negativeSampleRate()}
                  onInput={(e) => setNegativeSampleRate(e.currentTarget.value)}
                  placeholder="5"
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <select
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    if (v) setNegativeSampleRate(v);
                  }}
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">...</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="15">15</option>
                </select>
              </div>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-600">setOpMixRatio</span>
              <div class="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={setOpMixRatio()}
                  onInput={(e) => setSetOpMixRatio(e.currentTarget.value)}
                  placeholder="1.0"
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <select
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    if (v) setSetOpMixRatio(v);
                  }}
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">...</option>
                  <option value="0.4">0.4</option>
                  <option value="0.6">0.6</option>
                  <option value="0.8">0.8</option>
                  <option value="0.9">0.9</option>
                  <option value="1.0">1.0</option>
                </select>
              </div>
            </label>

            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-600">spread</span>
              <div class="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={spread()}
                  onInput={(e) => setSpread(e.currentTarget.value)}
                  placeholder="1.0"
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <select
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    if (v) setSpread(v);
                  }}
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">...</option>
                  <option value="1.0">1.0</option>
                  <option value="1.5">1.5</option>
                  <option value="2.0">2.0</option>
                  <option value="2.5">2.5</option>
                  <option value="3.0">3.0</option>
                </select>
              </div>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-gray-600">init</span>
              <select
                value={init()}
                onChange={(e) =>
                  setInit(
                    e.currentTarget.value === "random" ? "random" : "spectral"
                  )
                }
                class="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="spectral">spectral</option>
                <option value="random">random</option>
              </select>
            </label>
          </div>
        </div>

        <Show when={runs()} fallback={<p>Loading…</p>}>
          {(items) => (
            <div class="overflow-hidden rounded border border-gray-200">
              <table class="w-full text-sm">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="text-left p-2">Run</th>
                    <th class="text-left p-2">Dims</th>
                    <th class="text-left p-2">Embedding Run</th>
                    <th class="text-left p-2">Created</th>
                    <th class="text-left p-2">Clone</th>
                    <th class="text-right p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={items()}>
                    {(r) => (
                      <tr class="border-t border-gray-200 hover:bg-gray-50">
                        <td class="p-2">
                          <A href={`/umap/${r.id}`} class="hover:underline">
                            {r.id.slice(0, 8)}
                          </A>
                        </td>
                        <td class="p-2">{r.dims}D</td>
                        <td class="p-2">
                          <A
                            href={`/embeddings/${r.embeddingRunId}`}
                            class="text-blue-600 hover:underline"
                          >
                            {r.embeddingRunId.slice(0, 8)}
                          </A>
                        </td>
                        <td class="p-2">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                        <td class="p-2">
                          <button
                            type="button"
                            class="text-blue-600 hover:underline"
                            onClick={() => cloneRunToInputs(r)}
                          >
                            Clone
                          </button>
                        </td>
                        <td class="p-2 text-right">
                          <A
                            href={`/umap/${r.id}`}
                            class="text-blue-600 hover:underline"
                          >
                            View
                          </A>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          )}
        </Show>
      </div>
    </main>
  );
};

export default UmapIndex;
