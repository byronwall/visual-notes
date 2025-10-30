import {
  Show,
  createResource,
  createSignal,
  type VoidComponent,
} from "solid-js";
import SidePanel from "./SidePanel";
import { apiFetch } from "~/utils/base-url";
import DocumentViewer from "./DocumentViewer";
import { TitleEditPopover } from "./TitleEditPopover";
import { extractFirstHeading } from "~/utils/extractHeading";
import { updateDocTitle } from "~/services/docs.service";

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
  const [doc, { refetch }] = createResource(
    () => props.docId,
    (id) => fetchDoc(id)
  );
  const [editing, setEditing] = createSignal(false);

  const handleOpenEdit = () => {
    try {
      console.log("[SidePanel] open title edit for doc:", props.docId);
    } catch {}
    setEditing(true);
  };
  const handleCancelEdit = () => setEditing(false);
  const handleConfirmEdit = async (newTitle: string) => {
    if (!props.docId) return;
    try {
      await updateDocTitle(props.docId, newTitle);
      await refetch();
      try {
        console.log("[SidePanel] title updated → refetched");
      } catch {}
    } catch (e) {
      alert((e as Error).message || "Failed to update title");
    } finally {
      setEditing(false);
    }
  };

  return (
    <SidePanel
      open={props.open}
      onClose={() => props.onClose(false)}
      ariaLabel="Document details"
    >
      {/* Header */}
      <div class="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <div class="min-w-0 relative flex items-center gap-2">
          <div>
            <div class="text-sm text-gray-600">Note</div>
            <div class="font-medium text-gray-900 truncate flex items-center gap-2">
              <Show when={doc()} fallback={<span>Loading…</span>}>
                {(d) => {
                  const firstH1 = () =>
                    extractFirstHeading({
                      markdown: d().markdown,
                      html: d().html,
                    }) || "";
                  const showSync = () => firstH1() && firstH1() !== d().title;
                  const handleSync = async () => {
                    if (!props.docId) return;
                    const newTitle = firstH1();
                    if (!newTitle) return;
                    try {
                      console.log("[SidePanel] sync title to H1:", newTitle);
                    } catch {}
                    try {
                      await updateDocTitle(props.docId, newTitle);
                      await refetch();
                    } catch (e) {
                      alert((e as Error).message || "Failed to sync title");
                    }
                  };
                  return (
                    <>
                      <span class="truncate max-w-[16rem]" title={d().title}>
                        {d().title}
                      </span>
                      <button
                        type="button"
                        class="rounded p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                        aria-label="Edit title"
                        onClick={handleOpenEdit}
                      >
                        ✏️
                      </button>
                      <Show when={showSync()}>
                        <button
                          type="button"
                          class="text-xs rounded px-2 py-1 border border-gray-300 hover:bg-gray-100"
                          onClick={handleSync}
                          title={`Match H1: ${firstH1()}`}
                        >
                          Match H1
                        </button>
                      </Show>
                      <Show when={editing()}>
                        <TitleEditPopover
                          initialTitle={d().title}
                          onConfirm={handleConfirmEdit}
                          onCancel={handleCancelEdit}
                        />
                      </Show>
                    </>
                  );
                }}
              </Show>
            </div>
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
