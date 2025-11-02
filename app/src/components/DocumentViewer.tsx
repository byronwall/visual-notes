import { type VoidComponent, Show, createEffect, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { apiFetch } from "~/utils/base-url";
import DocumentEditor from "./DocumentEditor";
import { TitleEditPopover } from "./TitleEditPopover";
import { extractFirstHeading } from "~/utils/extractHeading";
import { updateDocTitle } from "~/services/docs.service";

type DocumentData = {
  id: string;
  title: string;
  markdown?: string;
  html?: string;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

const DocumentViewer: VoidComponent<{
  doc: DocumentData;
  onDeleted?: () => void;
}> = (props) => {
  try {
    console.log("[DocumentViewer] render docId=", props.doc?.id);
  } catch {}

  const navigate = useNavigate();
  const [busy, setBusy] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [title, setTitle] = createSignal(props.doc.title);
  const firstH1 = () =>
    extractFirstHeading({
      markdown: props.doc.markdown,
      html: props.doc.html,
    }) || "";
  const showSync = () => firstH1() && firstH1() !== title();

  const handleOpenEdit = () => {
    try {
      console.log("[DocumentViewer] open title edit for doc:", props.doc.id);
    } catch {}
    setEditing(true);
  };
  const handleCancelEdit = () => setEditing(false);
  const handleConfirmEdit = async (newTitle: string) => {
    try {
      await updateDocTitle(props.doc.id, newTitle);
      setTitle(newTitle);
      try {
        console.log("[DocumentViewer] title updated:", newTitle);
      } catch {}
    } catch (e) {
      alert((e as Error).message || "Failed to update title");
    } finally {
      setEditing(false);
    }
  };
  const handleSync = async () => {
    const newTitle = firstH1();
    if (!newTitle) return;
    try {
      await updateDocTitle(props.doc.id, newTitle);
      setTitle(newTitle);
    } catch (e) {
      alert((e as Error).message || "Failed to sync title");
    }
  };

  // Update page title to match note title
  createEffect(() => {
    const t = title();
    if (typeof document !== "undefined" && t) {
      document.title = `${t} • Visual Notes`;
    }
  });

  return (
    <div class="prose max-w-none">
      <div class="flex items-center justify-between">
        <div class="relative flex items-center gap-2">
          <h2 class="mt-0 m-0">{title()}</h2>
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
              initialTitle={title()}
              onConfirm={handleConfirmEdit}
              onCancel={handleCancelEdit}
            />
          </Show>
        </div>
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
              if (props.onDeleted) {
                try {
                  props.onDeleted();
                } catch (err) {
                  console.error("[DocumentViewer] onDeleted threw", err);
                }
              } else {
                navigate("/docs");
              }
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

      {/* Inline properties moved to page-level top section in docs/[id].tsx */}
    </div>
  );
};

export default DocumentViewer;
