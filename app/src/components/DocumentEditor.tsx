import type { Editor } from "@tiptap/core";
import {
  type VoidComponent,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";
import { useBeforeLeave } from "@solidjs/router";
import { extractFirstH1FromHtml } from "~/utils/extractHeading";
import {
  normalizeMarkdownToHtml,
  sanitizeHtmlContent,
} from "~/server/lib/markdown";
import { apiFetch } from "~/utils/base-url";
import TiptapEditor from "./TiptapEditor";
import { PathEditor } from "./PathEditor";
import { MetaKeyValueEditor } from "./MetaKeyValueEditor";
import { AIPromptsBar } from "./editor/ui/AIPromptsBar";

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
  docId?: string;
  class?: string;
  initialTitle?: string;
  initialMarkdown?: string;
  initialHTML?: string;
  onCreated?: (id: string) => void;
}> = (props) => {
  const [editor, setEditor] = createSignal<Editor | undefined>(undefined);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [savedAt, setSavedAt] = createSignal<Date | undefined>(undefined);
  const [dirty, setDirty] = createSignal(false);

  const [doc, { refetch }] = createResource(() => props.docId, fetchDoc);
  const [newPath, setNewPath] = createSignal<string>("");
  const [newMeta, setNewMeta] = createSignal<Record<string, string>>({});

  const isNew = createMemo(() => !props.docId);

  const displayTitle = createMemo(
    () => doc()?.title || props.initialTitle || "Untitled note"
  );

  // TODO: need to delete HTML from imports - just rely on markdown

  const initialHTML = createMemo(() => {
    const d = doc();
    if (d) {
      const rawHtml = d.html || normalizeMarkdownToHtml(d.markdown);
      const html = sanitizeHtmlContent(rawHtml);

      return html;
    }
    if (props.initialHTML) return props.initialHTML;

    console.log("[editor.initialHTML] initialMarkdown:", props.initialMarkdown);
    const html = normalizeMarkdownToHtml(
      props.initialMarkdown || "# Untitled\n\nStart writing..."
    );

    return html;
  });

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

  // Intercept Cmd+S / Ctrl+S to save
  createEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const isSave =
        (isMac && e.metaKey && e.key.toLowerCase() === "s") ||
        (!isMac && e.ctrlKey && e.key.toLowerCase() === "s");
      if (isSave) {
        e.preventDefault();
        void onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  // Warn on tab close/refresh when dirty
  createEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty()) return;
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    onCleanup(() => window.removeEventListener("beforeunload", handler));
  });

  // Block client-side route navigation when dirty
  useBeforeLeave((evt) => {
    if (!dirty()) return;
    evt.preventDefault();
  });

  async function onSave() {
    const ed = editor();
    const d = doc();
    if (!ed) return;
    setSaving(true);
    setError(undefined);
    try {
      const html = ed.getHTML();
      if (isNew()) {
        // First save → create the note
        let title = displayTitle();
        const detected = extractFirstH1FromHtml(html);
        if (detected && detected.trim().length > 0) title = detected.trim();
        console.log("[editor.save] creating new doc with title:", title);
        const res = await apiFetch(`/api/docs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            html,
            path: newPath() || undefined,
            meta: newMeta(),
          }),
        });
        const json = (await res.json().catch(() => ({}))) as any;
        console.log("[editor.save] create response", res.status, json);
        if (!res.ok || !json?.id) {
          throw new Error(json?.error || "Failed to create note");
        }
        setSavedAt(new Date());
        setDirty(false);
        if (props.onCreated) props.onCreated(String(json.id));
      } else {
        // Update existing
        await saveDoc(d!.id, { html });
        setSavedAt(new Date());
        setDirty(false);
        await refetch();
      }
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
          <Show when={doc()} fallback={<span>{displayTitle()}</span>}>
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
            disabled={saving() || !editor() || (props.docId ? !doc() : false)}
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
      <Show when={isNew()}>
        <div class="mb-3 space-y-3">
          <div>
            <div class="text-xs text-gray-600 mb-1">Path</div>
            <PathEditor onChange={(p) => setNewPath(p)} />
          </div>
          <div>
            <div class="text-xs text-gray-600 mb-1">Key/Value metadata</div>
            <MetaKeyValueEditor
              onChange={(m) => setNewMeta(m as Record<string, string>)}
            />
          </div>
        </div>
      </Show>
      <div class="mb-2">
        <AIPromptsBar editor={editor()} />
      </div>
      <TiptapEditor
        initialHTML={initialHTML()}
        onEditor={(ed) => setEditor(ed)}
      />
    </div>
  );
};

export default DocumentEditor;
