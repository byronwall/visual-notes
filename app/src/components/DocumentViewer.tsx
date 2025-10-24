import { type VoidComponent, Show, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { apiFetch } from "~/utils/base-url";
import DocumentEditor from "./DocumentEditor";

type DocumentData = {
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

const DocumentViewer: VoidComponent<{ doc: DocumentData }> = (props) => {
  try {
    console.log("[DocumentViewer] render docId=", props.doc?.id);
  } catch {}

  const navigate = useNavigate();
  const [busy, setBusy] = createSignal(false);
  const runs = () => props.doc?.embeddingRuns || [];

  return (
    <div class="prose max-w-none">
      <div class="flex items-center justify-between">
        <h2 class="mt-0">{props.doc.title}</h2>
        <button
          class="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
          disabled={busy()}
          onClick={async () => {
            if (!confirm("Delete this note? This cannot be undone.")) return;
            try {
              setBusy(true);
              console.log("[DocumentViewer] deleting docId=", props.doc?.id);
              const res = await apiFetch(`/api/docs/${props.doc.id}`, {
                method: "DELETE",
              });
              if (!res.ok) {
                const msg =
                  (await res.json().catch(() => ({})))?.error ||
                  "Failed to delete note";
                throw new Error(msg);
              }
              console.log("[DocumentViewer] deleted docId=", props.doc?.id);
              navigate("/docs");
            } catch (e) {
              console.error(e);
              alert((e as Error).message || "Failed to delete note");
            } finally {
              setBusy(false);
            }
          }}
        >
          Delete Note
        </button>
      </div>
      <DocumentEditor docId={props.doc.id} />

      <details class="rounded border border-gray-200 p-3 mb-4">
        <summary class="cursor-pointer select-none font-medium">
          Metadata
        </summary>
        <div class="mt-2">
          <pre class="text-xs bg-gray-50 p-3 rounded border overflow-x-auto">
            <code>{JSON.stringify(props.doc, null, 2)}</code>
          </pre>
        </div>
      </details>

      <details class="rounded border border-gray-200 p-3 mb-4">
        <summary class="cursor-pointer select-none font-medium">
          Embeddings
        </summary>
        <div class="mt-2 text-sm">
          <Show
            when={runs().length > 0}
            fallback={
              <div class="text-gray-600">No embeddings for this note.</div>
            }
          >
            <ul class="not-prose divide-y border rounded">
              {runs().map((r) => (
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
                      <div class="text-xs text-gray-700">Vector preview:</div>
                      <pre class="text-[11px] bg-gray-50 p-2 rounded border overflow-x-auto">
                        <code>{JSON.stringify(r.vectorPreview)}</code>
                      </pre>
                    </div>
                  </Show>
                  <Show
                    when={r.params && Object.keys(r.params || {}).length > 0}
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
    </div>
  );
};

export default DocumentViewer;
