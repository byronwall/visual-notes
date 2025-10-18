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

async function triggerUmapRun(embeddingRunId: string, dims: 2 | 3) {
  const res = await apiFetch(`/api/umap/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeddingRunId, dims }),
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
                  await triggerUmapRun(selectedEmbedding(), dims());
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
