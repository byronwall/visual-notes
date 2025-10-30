import {
  Show,
  createEffect,
  createResource,
  type VoidComponent,
} from "solid-js";
import SidePanel from "./SidePanel";
import { apiFetch } from "~/utils/base-url";
import DocumentViewer from "./DocumentViewer";

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
  onClose: (shouldRefetch?: boolean) => void;
}> = (props) => {
  const [doc] = createResource(
    () => props.docId,
    (id) => fetchDoc(id)
  );

  return (
    <SidePanel
      open={props.open}
      onClose={() => props.onClose(false)}
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
          onClick={() => props.onClose(false)}
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
            <DocumentViewer
              doc={d}
              onDeleted={() => {
                try {
                  console.log("[DocumentSidePanel] onDeleted → closing panel");
                } catch {}
                props.onClose(true);
              }}
            />
          )}
        </Show>
      </div>
    </SidePanel>
  );
};

export default DocumentSidePanel;
