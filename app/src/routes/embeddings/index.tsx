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

async function triggerEmbeddingRun(
  model?: string,
  params?: Record<string, unknown>
) {
  const res = await apiFetch("/api/embeddings/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, params }),
  });
  if (!res.ok)
    throw new Error((await res.json()).error || "Failed to create run");
  return (await res.json()) as { runId: string; count: number };
}

const EmbeddingsIndex: VoidComponent = () => {
  const [runs, { refetch }] = createResource(listEmbeddingRuns);
  const [creating, setCreating] = createSignal(false);
  const [model, setModel] = createSignal("");
  const [showAdvanced, setShowAdvanced] = createSignal(false);
  // Preprocess flags
  const [stripDataUris, setStripDataUris] = createSignal(true);
  const [mdToPlain, setMdToPlain] = createSignal(true);
  const [stripBareUrls, setStripBareUrls] = createSignal(true);
  const [normalizeWs, setNormalizeWs] = createSignal(true);
  const [keepOutline, setKeepOutline] = createSignal(true);
  const [codeblockPolicy, setCodeblockPolicy] = createSignal<
    "stub" | "keep-first-20-lines" | "full"
  >("stub");
  // Chunker config
  const [chunkerMode, setChunkerMode] = createSignal<"structure" | "sliding">(
    "structure"
  );
  const [minTokens, setMinTokens] = createSignal(100);
  const [maxTokens, setMaxTokens] = createSignal(400);
  const [winSize, setWinSize] = createSignal(384);
  const [winOverlap, setWinOverlap] = createSignal(48);

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
              class="px-2 py-1 rounded border text-sm"
              onClick={() => setShowAdvanced(!showAdvanced())}
            >
              {showAdvanced() ? "Hide Advanced" : "Advanced"}
            </button>
            <button
              class="cta"
              disabled={creating()}
              onClick={async () => {
                try {
                  setCreating(true);
                  const params = {
                    PREPROCESS_STRIP_DATA_URIS: stripDataUris(),
                    PREPROCESS_MARKDOWN_TO_PLAIN: mdToPlain(),
                    PREPROCESS_STRIP_BARE_URLS: stripBareUrls(),
                    PREPROCESS_CODEBLOCK_POLICY: codeblockPolicy(),
                    PREPROCESS_NORMALIZE_WHITESPACE: normalizeWs(),
                    PREPROCESS_KEEP_OUTLINE: keepOutline(),
                    CHUNKER_MODE: chunkerMode(),
                    CHUNK_MIN_MAX_TOKENS:
                      chunkerMode() === "sliding"
                        ? { size: winSize(), overlap: winOverlap() }
                        : { min: minTokens(), max: maxTokens() },
                  } as Record<string, unknown>;
                  await triggerEmbeddingRun(model() || undefined, params);
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

        <Show when={showAdvanced()}>
          <div class="rounded border border-gray-200 p-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div class="font-medium mb-2">Preprocessing</div>
              <label class="flex items-center gap-2 mb-1">
                <input
                  type="checkbox"
                  checked={stripDataUris()}
                  onInput={(e) => setStripDataUris(e.currentTarget.checked)}
                />{" "}
                Strip data URIs
              </label>
              <label class="flex items-center gap-2 mb-1">
                <input
                  type="checkbox"
                  checked={mdToPlain()}
                  onInput={(e) => setMdToPlain(e.currentTarget.checked)}
                />{" "}
                Markdown → plain
              </label>
              <label class="flex items-center gap-2 mb-1">
                <input
                  type="checkbox"
                  checked={stripBareUrls()}
                  onInput={(e) => setStripBareUrls(e.currentTarget.checked)}
                />{" "}
                Strip bare URLs
              </label>
              <label class="flex items-center gap-2 mb-1">
                <input
                  type="checkbox"
                  checked={normalizeWs()}
                  onInput={(e) => setNormalizeWs(e.currentTarget.checked)}
                />{" "}
                Normalize whitespace
              </label>
              <label class="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={keepOutline()}
                  onInput={(e) => setKeepOutline(e.currentTarget.checked)}
                />{" "}
                Keep outline (H1→H3)
              </label>
              <div class="flex items-center gap-2">
                <span>Code blocks</span>
                <select
                  value={codeblockPolicy()}
                  onChange={(e) =>
                    setCodeblockPolicy(e.currentTarget.value as any)
                  }
                  class="border border-gray-300 rounded px-2 py-1"
                >
                  <option value="stub">stub</option>
                  <option value="keep-first-20-lines">
                    keep-first-20-lines
                  </option>
                  <option value="full">full</option>
                </select>
              </div>
            </div>
            <div>
              <div class="font-medium mb-2">Chunking</div>
              <div class="flex items-center gap-2 mb-2">
                <span>Mode</span>
                <select
                  value={chunkerMode()}
                  onChange={(e) => setChunkerMode(e.currentTarget.value as any)}
                  class="border border-gray-300 rounded px-2 py-1"
                >
                  <option value="structure">structure</option>
                  <option value="sliding">sliding</option>
                </select>
              </div>
              <Show when={chunkerMode() === "structure"}>
                <div class="flex items-center gap-2 mb-2">
                  <label>Min tokens</label>
                  <input
                    type="number"
                    class="border rounded px-2 py-1 w-24"
                    value={String(minTokens())}
                    onInput={(e) =>
                      setMinTokens(
                        Math.max(1, Number(e.currentTarget.value) || 0)
                      )
                    }
                  />
                  <label>Max tokens</label>
                  <input
                    type="number"
                    class="border rounded px-2 py-1 w-24"
                    value={String(maxTokens())}
                    onInput={(e) =>
                      setMaxTokens(
                        Math.max(
                          minTokens(),
                          Number(e.currentTarget.value) || 0
                        )
                      )
                    }
                  />
                </div>
              </Show>
              <Show when={chunkerMode() === "sliding"}>
                <div class="flex items-center gap-2 mb-2">
                  <label>Window size</label>
                  <input
                    type="number"
                    class="border rounded px-2 py-1 w-28"
                    value={String(winSize())}
                    onInput={(e) =>
                      setWinSize(
                        Math.max(32, Number(e.currentTarget.value) || 0)
                      )
                    }
                  />
                  <label>Overlap</label>
                  <input
                    type="number"
                    class="border rounded px-2 py-1 w-24"
                    value={String(winOverlap())}
                    onInput={(e) =>
                      setWinOverlap(
                        Math.max(0, Number(e.currentTarget.value) || 0)
                      )
                    }
                  />
                </div>
              </Show>
            </div>
          </div>
        </Show>

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
