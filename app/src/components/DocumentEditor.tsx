import {
  type VoidComponent,
  Show,
  createEffect,
  createResource,
  createSignal,
} from "solid-js";
import TiptapExample from "./TiptapExample";
import type { Editor } from "@tiptap/core";
import { apiFetch } from "~/utils/base-url";
import { normalizeAiOutputToHtml } from "~/server/lib/markdown";

type DocData = { id: string; title: string; markdown?: string; html?: string };

async function fetchDoc(id: string): Promise<DocData> {
  const res = await apiFetch(`/api/docs/${id}`);
  if (!res.ok) throw new Error("Failed to load doc");
  return (await res.json()) as DocData;
}

async function saveDoc(
  id: string,
  input: { title?: string; markdown?: string; html?: string }
) {
  const res = await apiFetch(`/api/docs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))) as any;
    throw new Error(msg?.error || "Failed to save");
  }
  return res.json();
}

const DocumentEditor: VoidComponent<{
  docId: string;
  class?: string;
}> = (props) => {
  const [editor, setEditor] = createSignal<Editor | undefined>(undefined);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [savedAt, setSavedAt] = createSignal<Date | undefined>(undefined);
  const [dirty, setDirty] = createSignal(false);

  const [doc, { refetch }] = createResource(() => props.docId, fetchDoc);

  // Track editor updates to mark dirty
  createEffect(() => {
    const ed = editor();
    if (!ed) return;
    const handler = () => setDirty(true);
    ed.on("update", handler);
    return () => {
      ed.off("update", handler);
    };
  });

  async function onSave() {
    const ed = editor();
    const d = doc();
    if (!ed || !d) return;
    setSaving(true);
    setError(undefined);
    try {
      const html = ed.getHTML();
      await saveDoc(d.id, { html });
      setSavedAt(new Date());
      setDirty(false);
      await refetch();
    } catch (e) {
      setError((e as Error).message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class={props.class || "w-full"}>
      <div class="flex items-center gap-2 mb-2">
        <div class="text-sm font-medium truncate">
          <Show when={doc()} fallback={<span>Loading…</span>}>
            {(d) => <span>{d().title}</span>}
          </Show>
        </div>
        <div class="ml-auto flex items-center gap-2 text-xs">
          <Show when={dirty()}>
            <span class="text-amber-700">Unsaved changes</span>
          </Show>
          <Show when={savedAt()}>
            {(t) => (
              <span class="text-gray-600">
                Saved {t().toLocaleTimeString()}
              </span>
            )}
          </Show>
          <button
            class={`rounded px-3 py-1.5 border text-xs ${
              saving() ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-50"
            }`}
            disabled={saving() || !doc()}
            onClick={onSave}
          >
            {saving() ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <Show when={error()}>
        {(e) => (
          <div class="mb-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
            {e()}
          </div>
        )}
      </Show>
      <Show
        when={doc()}
        fallback={<div class="text-sm text-gray-600">Loading…</div>}
      >
        {(d) => {
          const html = normalizeAiOutputToHtml(d().html || d().markdown || "");
          return (
            <TiptapExample
              initialHTML={html}
              onEditor={(ed) => setEditor(ed)}
            />
          );
        }}
      </Show>
    </div>
  );
};

export default DocumentEditor;
