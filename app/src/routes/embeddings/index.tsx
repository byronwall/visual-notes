import {
  type VoidComponent,
  For,
  Show,
  createResource,
  createSignal,
} from "solid-js";
import { A } from "@solidjs/router";
import { apiFetch } from "~/utils/base-url";

type EmbeddingRun = {
  id: string;
  model: string;
  dims: number;
  params: Record<string, unknown> | null;
  createdAt: string;
  count: number;
};

async function listEmbeddingRuns(): Promise<EmbeddingRun[]> {
  const res = await apiFetch("/api/embeddings/runs");
  if (!res.ok) throw new Error("Failed to load embedding runs");
  const json = (await res.json()) as { runs: EmbeddingRun[] };
  return json.runs || [];
}

async function triggerEmbeddingRun(model?: string) {
  const res = await apiFetch("/api/embeddings/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
  if (!res.ok)
    throw new Error((await res.json()).error || "Failed to create run");
  return (await res.json()) as { runId: string; count: number };
}

const EmbeddingsIndex: VoidComponent = () => {
  const [runs, { refetch }] = createResource(listEmbeddingRuns);
  const [creating, setCreating] = createSignal(false);
  const [model, setModel] = createSignal("");

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4 space-y-6">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold">Embeddings</h1>
          <div class="flex items-center gap-2">
            <input
              value={model()}
              onInput={(e) => setModel(e.currentTarget.value)}
              placeholder="Model (optional)"
              class="border border-gray-300 rounded px-2 py-1 text-sm"
            />
            <button
              class="cta"
              disabled={creating()}
              onClick={async () => {
                try {
                  setCreating(true);
                  await triggerEmbeddingRun(model() || undefined);
                  await refetch();
                  setModel("");
                } catch (e) {
                  console.error(e);
                  alert("Failed to start embedding run");
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
                    <th class="text-left p-2">Model</th>
                    <th class="text-left p-2">Dims</th>
                    <th class="text-left p-2">Notes</th>
                    <th class="text-left p-2">Created</th>
                    <th class="text-right p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={items()}>
                    {(r) => (
                      <tr class="border-t border-gray-200 hover:bg-gray-50">
                        <td class="p-2">
                          <A
                            href={`/embeddings/${r.id}`}
                            class="hover:underline"
                          >
                            {r.id.slice(0, 8)}
                          </A>
                        </td>
                        <td class="p-2">{r.model}</td>
                        <td class="p-2">{r.dims}</td>
                        <td class="p-2">{r.count}</td>
                        <td class="p-2">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                        <td class="p-2 text-right">
                          <A
                            href={`/embeddings/${r.id}`}
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

export default EmbeddingsIndex;
