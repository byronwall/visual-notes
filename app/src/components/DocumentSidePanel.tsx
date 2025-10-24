import { Show, createResource, type VoidComponent } from "solid-js";
import SidePanel from "./SidePanel";
import { apiFetch } from "~/utils/base-url";
import DocumentEditor from "./DocumentEditor";

type DocResponse = {
  id: string;
  title: string;
  markdown?: string;
  html?: string;
  createdAt?: string;
  updatedAt?: string;
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

async function fetchDoc(id: string): Promise<DocResponse> {
  const res = await apiFetch(`/api/docs/${id}`);
  if (!res.ok) throw new Error("Failed to load doc");
  return (await res.json()) as DocResponse;
}

const DocumentSidePanel: VoidComponent<{
  open: boolean;
  docId?: string;
  onClose: () => void;
}> = (props) => {
  const [doc] = createResource(
    () => (props.open && props.docId ? props.docId : undefined),
    (id) => fetchDoc(id!)
  );

  // Helpful debug breadcrumbs
  try {
    console.log(
      "[DocumentSidePanel] open=",
      !!props.open,
      "docId=",
      props.docId
    );
  } catch {}

  return (
    <SidePanel
      open={props.open}
      onClose={props.onClose}
      ariaLabel="Document details"
    >
      {/* Header */}
      <div class="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <div class="min-w-0">
          <div class="text-sm text-gray-600">Note</div>
          <div class="font-medium text-gray-900 truncate">
            <Show when={doc()} fallback={<span>Loading…</span>}>
              {(d) => <span>{d().title}</span>}
            </Show>
          </div>
        </div>
        <a
          class="ml-auto text-xs text-blue-600 hover:underline whitespace-nowrap"
          href={props.docId ? `/docs/${props.docId}` : "#"}
          onClick={(e) => {
            if (!props.docId) e.preventDefault();
          }}
        >
          Open full page
        </a>
        <button
          type="button"
          class="ml-1 rounded p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
          aria-label="Close panel"
          onClick={props.onClose}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div class="px-4 py-4">
        <Show
          when={doc()}
          keyed
          fallback={<div class="text-sm text-gray-600">Loading…</div>}
        >
          {(d) => (
            <div class="prose max-w-none">
              {/* Match details page sections */}
              <details class="rounded border border-gray-200 p-3 mb-4">
                <summary class="cursor-pointer select-none font-medium">
                  Metadata
                </summary>
                <div class="mt-2">
                  <pre class="text-xs bg-gray-50 p-3 rounded border overflow-x-auto">
                    <code>{JSON.stringify(d, null, 2)}</code>
                  </pre>
                </div>
              </details>

              <details class="rounded border border-gray-200 p-3 mb-4">
                <summary class="cursor-pointer select-none font-medium">
                  Embeddings
                </summary>
                <div class="mt-2 text-sm">
                  <Show
                    when={(d.embeddingRuns?.length || 0) > 0}
                    fallback={
                      <div class="text-gray-600">
                        No embeddings for this note.
                      </div>
                    }
                  >
                    <ul class="not-prose divide-y border rounded">
                      {(d.embeddingRuns || []).map((r) => (
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

              <h2 class="mt-0">{d.title}</h2>
              <DocumentEditor docId={d.id} />
            </div>
          )}
        </Show>
      </div>
    </SidePanel>
  );
};

export default DocumentSidePanel;
