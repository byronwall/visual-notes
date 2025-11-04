import {
  type VoidComponent,
  Show,
  createResource,
  createSignal,
} from "solid-js";
import { useParams, A, useNavigate } from "@solidjs/router";
import { apiFetch } from "~/utils/base-url";

type EmbeddingRun = {
  id: string;
  model: string;
  dims: number;
  params: Record<string, unknown> | null;
  createdAt: string;
  count: number;
  sectionCount?: number;
  remaining?: number;
  changedEligible?: number;
  docs?: {
    items: { id: string; title: string; embeddedAt: string }[];
    limit: number;
    offset: number;
  };
};

const DOCS_LIMIT = 50;

async function fetchEmbeddingRun(key: {
  id: string;
  offset: number;
}): Promise<EmbeddingRun> {
  const res = await apiFetch(
    `/api/embeddings/runs/${encodeURIComponent(
      key.id
    )}?include=docs&limit=${DOCS_LIMIT}&offset=${key.offset}`
  );
  if (!res.ok) throw new Error("Failed to load run");
  return (await res.json()) as EmbeddingRun;
}

async function deleteEmbeddingRun(id: string) {
  const res = await apiFetch(`/api/embeddings/runs/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete run");
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

async function processMore(id: string, limit: number) {
  const res = await apiFetch(`/api/embeddings/runs/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit }),
  });
  if (!res.ok)
    throw new Error((await res.json()).error || "Failed to process more");
  return (await res.json()) as { added: number; remaining: number };
}

async function processChanged(id: string, limit: number) {
  const res = await apiFetch(`/api/embeddings/runs/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit, mode: "changed" }),
  });
  if (!res.ok)
    throw new Error((await res.json()).error || "Failed to process changed");
  return (await res.json()) as { added: number; remaining: number };
}

const EmbeddingDetail: VoidComponent = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [docsOffset, setDocsOffset] = createSignal(0);
  const [run, { refetch }] = createResource(
    () => ({ id: params.id, offset: docsOffset() }),
    fetchEmbeddingRun
  );
  const [busy, setBusy] = createSignal(false);
  const [dims, setDims] = createSignal<2 | 3>(2);
  const [batchSize, setBatchSize] = createSignal(200);
  const [selectedDocId, setSelectedDocId] = createSignal<string | null>(null);
  const [sections, setSections] = createSignal<
    {
      id: string;
      headingPath: string[];
      orderIndex: number;
      charCount: number;
      preview: string;
      embedded?: boolean;
    }[]
  >([]);

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4 space-y-6">
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <h1 class="text-2xl font-bold">Embedding Run</h1>
            <Show when={run()}>
              {(r) => (
                <div class="text-sm text-gray-600">
                  <div>
                    <span class="font-medium">ID:</span> {r().id}
                  </div>
                  <div>
                    <span class="font-medium">Model:</span> {r().model}
                  </div>
                  <div>
                    <span class="font-medium">Dims:</span> {r().dims}
                  </div>
                  <div>
                    <span class="font-medium">Embeddings:</span> {r().count}
                  </div>
                  <Show when={r().sectionCount !== undefined}>
                    <div>
                      <span class="font-medium">Sections:</span>{" "}
                      {r().sectionCount}
                    </div>
                  </Show>
                  <div>
                    <span class="font-medium">Created:</span>{" "}
                    {new Date(r().createdAt).toLocaleString()}
                  </div>
                  <Show when={r().params}>
                    <div class="mt-2">
                      <span class="font-medium">Params:</span>
                      <pre class="text-xs bg-gray-50 border rounded p-2 overflow-auto max-h-40">
                        {JSON.stringify(r().params, null, 2)}
                      </pre>
                    </div>
                  </Show>
                </div>
              )}
            </Show>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
              disabled={busy()}
              onClick={async () => {
                if (!confirm("Delete this embedding run?")) return;
                try {
                  setBusy(true);
                  await deleteEmbeddingRun(params.id);
                  navigate("/embeddings");
                } catch (e) {
                  console.error(e);
                  alert("Failed to delete run");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete Run
            </button>
          </div>
        </div>

        <div class="rounded border border-gray-200 p-3 space-y-3">
          <div class="font-medium">Create UMAP Projection</div>
          <div class="flex items-center gap-3">
            <label class="text-sm">Dims</label>
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
              disabled={busy()}
              onClick={async () => {
                try {
                  setBusy(true);
                  const r = await triggerUmapRun(params.id, dims());
                  navigate(`/umap/${r.runId}`);
                } catch (e) {
                  console.error(e);
                  alert("Failed to start UMAP run");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Start UMAP
            </button>
          </div>
        </div>

        <div class="rounded border border-gray-200 p-3 space-y-3">
          <div class="flex items-center justify-between">
            <div class="font-medium">Process More Notes</div>
            <Show when={run()}>
              {(r) => (
                <div class="text-sm text-gray-600">
                  Remaining: {r().remaining ?? Math.max(0, r().count || 0)}
                </div>
              )}
            </Show>
          </div>
          <div class="flex items-center gap-3">
            <label class="text-sm">Batch size</label>
            <input
              type="number"
              min="1"
              max="500"
              value={String(batchSize())}
              onInput={(e) =>
                setBatchSize(
                  Math.max(1, Math.min(500, Number(e.currentTarget.value) || 0))
                )
              }
              class="border border-gray-300 rounded px-2 py-1 text-sm w-24"
            />
            <button
              class="cta"
              disabled={busy()}
              onClick={async () => {
                try {
                  setBusy(true);
                  await processMore(params.id, batchSize());
                  await refetch();
                } catch (e) {
                  console.error(e);
                  alert("Failed to process more notes");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy() ? "Processing…" : "Process More"}
            </button>
          </div>
        </div>

        <div class="rounded border border-gray-200 p-3 space-y-3">
          <div class="flex items-center justify-between">
            <div class="font-medium">Re-embed Changed Notes</div>
            <Show when={run()}>
              {(r) => (
                <div class="text-sm text-gray-600">
                  Changed eligible: {r().changedEligible ?? 0}
                </div>
              )}
            </Show>
          </div>
          <div class="flex items-center gap-3">
            <label class="text-sm">Batch size</label>
            <input
              type="number"
              min="1"
              max="500"
              value={String(batchSize())}
              onInput={(e) =>
                setBatchSize(
                  Math.max(1, Math.min(500, Number(e.currentTarget.value) || 0))
                )
              }
              class="border border-gray-300 rounded px-2 py-1 text-sm w-24"
            />
            <button
              class="cta"
              disabled={busy()}
              onClick={async () => {
                try {
                  setBusy(true);
                  await processChanged(params.id, batchSize());
                  await refetch();
                } catch (e) {
                  console.error(e);
                  alert("Failed to process changed notes");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy() ? "Processing…" : "Process Changed"}
            </button>
          </div>
        </div>

        <Show when={run()}>
          {(r) => (
            <>
              <div class="rounded border border-gray-200 p-3 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="font-medium">Included Notes</div>
                  <div class="text-sm text-gray-600">
                    {(() => {
                      const start = (r().docs?.offset || 0) + 1;
                      const end =
                        (r().docs?.offset || 0) +
                        (r().docs?.items?.length || 0);
                      return `Showing ${start}-${end} of ${r().count}`;
                    })()}
                  </div>
                </div>

                <div class="divide-y border rounded">
                  <Show
                    when={(r().docs?.items?.length || 0) > 0}
                    fallback={
                      <div class="p-3 text-sm text-gray-600">
                        No notes found.
                      </div>
                    }
                  >
                    <ul>
                      {r().docs!.items.map((d) => (
                        <li class="p-3 flex items-center justify-between">
                          <div class="min-w-0">
                            <A
                              href={`/docs/${d.id}`}
                              class="text-blue-600 hover:underline truncate block"
                            >
                              {d.title}
                            </A>
                            <div class="text-xs text-gray-500">
                              {new Date(d.embeddedAt).toLocaleString()}
                            </div>
                          </div>
                          <div class="flex items-center gap-2">
                            <button
                              class="text-sm text-blue-600 underline whitespace-nowrap"
                              onClick={async () => {
                                setSelectedDocId(d.id);
                                const res = await apiFetch(
                                  `/api/embeddings/runs/docs/${encodeURIComponent(
                                    d.id
                                  )}/sections?runId=${encodeURIComponent(
                                    params.id
                                  )}`
                                );
                                if (res.ok) {
                                  const json = (await res.json()) as {
                                    items: any[];
                                  };
                                  setSections(json.items as any);
                                }
                              }}
                            >
                              Sections
                            </button>
                            <A
                              href={`/docs/${d.id}`}
                              class="text-sm text-blue-600 hover:underline whitespace-nowrap ml-1"
                            >
                              Open
                            </A>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Show>
                </div>

                <div class="flex items-center justify-between pt-2">
                  <button
                    class="px-3 py-1.5 rounded border text-sm disabled:opacity-50"
                    disabled={(run()?.docs?.offset || 0) <= 0}
                    onClick={() =>
                      setDocsOffset(
                        Math.max(0, (run()?.docs?.offset || 0) - DOCS_LIMIT)
                      )
                    }
                  >
                    Previous
                  </button>
                  <button
                    class="px-3 py-1.5 rounded border text-sm disabled:opacity-50"
                    disabled={(() => {
                      const off = run()?.docs?.offset || 0;
                      const len = run()?.docs?.items?.length || 0;
                      return off + len >= (run()?.count || 0);
                    })()}
                    onClick={() =>
                      setDocsOffset((run()?.docs?.offset || 0) + DOCS_LIMIT)
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
              <Show when={selectedDocId()}>
                <div class="rounded border border-gray-200 p-3 space-y-2">
                  <div class="font-medium">Sections for note</div>
                  <ul class="space-y-1 text-sm">
                    {sections().map((s) => (
                      <li class="border rounded p-2">
                        <div class="text-gray-600 text-xs mb-1">
                          {(s.headingPath || []).join(" → ") || "(no heading)"}
                          <span class="ml-2">#{s.orderIndex}</span>
                          <Show when={s.embedded}>
                            <span class="ml-2 inline-block px-1.5 py-0.5 text-[10px] rounded bg-green-50 text-green-700 border border-green-200">
                              embedded
                            </span>
                          </Show>
                        </div>
                        <div class="truncate">{s.preview}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </Show>
            </>
          )}
        </Show>

        <A href="/embeddings" class="text-blue-600 hover:underline text-sm">
          ← Back to Embeddings
        </A>
      </div>
    </main>
  );
};

export default EmbeddingDetail;
