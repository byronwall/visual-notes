import { useParams } from "@solidjs/router";
import { type VoidComponent, Show, createResource } from "solid-js";
import { apiFetch } from "~/utils/base-url";
import DocumentEditor from "../../components/DocumentEditor";

type DocResponse = {
  id: string;
  title: string;
  markdown: string;
  html: string;
  createdAt: string;
  updatedAt: string;
  embeddingRuns?: {
    id: string;
    model?: string;
    dims?: number;
    params?: Record<string, unknown> | null;
    runCreatedAt?: string;
    embeddedAt?: string;
    vectorDims?: number;
    vectorPreview?: number[];
  }[];
};

async function fetchDoc(id: string) {
  const res = await apiFetch(`/api/docs/${id}`);
  if (!res.ok) throw new Error("Failed to load doc");
  return (await res.json()) as DocResponse;
}

const DocView: VoidComponent = () => {
  const params = useParams();
  const [doc] = createResource(
    () => params.id,
    (id) => fetchDoc(id!)
  );

  return (
    <main class="min-h-screen bg-white">
      <div class="container mx-auto p-4">
        <Show when={doc()} fallback={<p>Loading…</p>}>
          {(d) => (
            <article class="prose max-w-none">
              <details class="rounded border border-gray-200 p-3 mb-4">
                <summary class="cursor-pointer select-none font-medium">
                  Metadata
                </summary>
                <div class="mt-2">
                  <pre class="text-xs bg-gray-50 p-3 rounded border overflow-x-auto">
                    <code>{JSON.stringify(d(), null, 2)}</code>
                  </pre>
                </div>
              </details>

              <details class="rounded border border-gray-200 p-3 mb-4">
                <summary class="cursor-pointer select-none font-medium">
                  Embeddings
                </summary>
                <div class="mt-2 text-sm">
                  <Show
                    when={(d().embeddingRuns?.length || 0) > 0}
                    fallback={
                      <div class="text-gray-600">
                        No embeddings for this note.
                      </div>
                    }
                  >
                    <ul class="not-prose divide-y border rounded">
                      {d().embeddingRuns!.map((r) => (
                        <li class="p-3">
                          <div class="flex items-center justify-between gap-3">
                            <div class="min-w-0">
                              <div class="font-medium truncate">Run {r.id}</div>
                              <div class="text-xs text-gray-600">
                                Model: {r.model || "-"} · Dims:{" "}
                                {r.dims || r.vectorDims || 0}
                              </div>
                              <div class="text-xs text-gray-600">
                                Embedded:{" "}
                                {r.embeddedAt
                                  ? new Date(r.embeddedAt).toLocaleString()
                                  : "-"}
                                {" · Run: "}
                                {r.runCreatedAt
                                  ? new Date(r.runCreatedAt).toLocaleString()
                                  : "-"}
                              </div>
                            </div>
                            <a
                              class="text-blue-600 text-sm whitespace-nowrap hover:underline"
                              href={`/embeddings/runs/${r.id}`}
                            >
                              View run
                            </a>
                          </div>
                          <Show when={(r.vectorPreview?.length || 0) > 0}>
                            <div class="mt-2">
                              <div class="text-xs text-gray-700">
                                Vector preview:
                              </div>
                              <pre class="text-[11px] bg-gray-50 p-2 rounded border overflow-x-auto">
                                <code>{JSON.stringify(r.vectorPreview)}</code>
                              </pre>
                            </div>
                          </Show>
                          <Show
                            when={
                              r.params && Object.keys(r.params || {}).length > 0
                            }
                          >
                            <div class="mt-2">
                              <div class="text-xs text-gray-700">Params:</div>
                              <pre class="text-[11px] bg-gray-50 p-2 rounded border overflow-x-auto">
                                <code>{JSON.stringify(r.params, null, 2)}</code>
                              </pre>
                            </div>
                          </Show>
                        </li>
                      ))}
                    </ul>
                  </Show>
                </div>
              </details>
              <h1 class="mb-2">{d().title}</h1>
              <DocumentEditor docId={d().id} />
            </article>
          )}
        </Show>
      </div>
    </main>
  );
};

export default DocView;
