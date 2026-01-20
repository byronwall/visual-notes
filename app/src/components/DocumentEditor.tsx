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
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Text } from "~/components/ui/text";
import { Box, HStack, Stack } from "styled-system/jsx";

type DocData = { id: string; title: string; markdown?: string; html?: string };

export type DocumentEditorApi = {
  save: () => Promise<void>;
  canSave: () => boolean;
  saving: () => boolean;
  dirty: () => boolean;
};

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
  apiRef?: (api: DocumentEditorApi) => void;
  showTopBar?: boolean;
  showAiPromptsBar?: boolean;
  showTitleInTopBar?: boolean;
  showSaveButtonInTopBar?: boolean;
}> = (props) => {
  const [editor, setEditor] = createSignal<Editor | undefined>(undefined);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [savedAt, setSavedAt] = createSignal<Date | undefined>(undefined);
  const [dirty, setDirty] = createSignal(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = createSignal(false);
  const [pendingRetry, setPendingRetry] = createSignal<(() => void) | null>(
    null
  );

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
    if (leaveDialogOpen()) return;
    if (evt.defaultPrevented) return;
    evt.preventDefault();
    setPendingRetry(() => () => evt.retry(true));
    setLeaveDialogOpen(true);
  });

  const canSave = () => {
    if (saving()) return false;
    if (!editor()) return false;
    // For an existing doc, block save until the doc resource loads.
    if (props.docId) return !!doc();
    return true;
  };

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

  if (props.apiRef) {
    props.apiRef({
      save: onSave,
      canSave,
      saving,
      dirty,
    });
  }

  const shouldShowTopBar = () => props.showTopBar !== false;
  const shouldShowAiPromptsBar = () => props.showAiPromptsBar !== false;
  const shouldShowTitleInTopBar = () => props.showTitleInTopBar !== false;
  const shouldShowSaveButtonInTopBar = () =>
    props.showSaveButtonInTopBar !== false;

  const handleLeaveConfirm = () => {
    const retry = pendingRetry();
    setPendingRetry(null);
    if (retry) retry();
  };

  const handleLeaveOpenChange = (open: boolean) => {
    setLeaveDialogOpen(open);
    if (!open) setPendingRetry(null);
  };

  return (
    <Box class={props.class} w="full">
      <Show when={shouldShowTopBar()}>
        <HStack gap="2" alignItems="center" mb="2" flexWrap="wrap">
          <Show when={shouldShowTitleInTopBar()}>
            <Text fontSize="sm" fontWeight="medium" truncate>
              <Show when={doc()} fallback={<span>{displayTitle()}</span>}>
                {(d) => <span>{d().title}</span>}
              </Show>
            </Text>
          </Show>
          <HStack gap="2" alignItems="center" ml="auto" flexWrap="wrap">
            <Show when={savedAt()}>
              {(t) => (
                <Text fontSize="xs" color="fg.muted">
                  Saved {t().toLocaleTimeString()}
                </Text>
              )}
            </Show>
            <Show when={shouldShowSaveButtonInTopBar()}>
              <Button
                size="xs"
                variant="outline"
                colorPalette="gray"
                disabled={!canSave()}
                onClick={onSave}
              >
                {saving() ? "Saving…" : dirty() ? "Save*" : "Save"}
              </Button>
            </Show>
          </HStack>
        </HStack>
      </Show>
      <Show when={error()}>
        {(e) => (
          <Box
            mb="2"
            px="2"
            py="1"
            borderWidth="1px"
            borderColor="red.7"
            bg="red.2"
            borderRadius="l2"
          >
            <Text fontSize="xs" color="red.11">
              {e()}
            </Text>
          </Box>
        )}
      </Show>
      <Show when={isNew()}>
        <Stack gap="3" mb="3">
          <Stack gap="1">
            <Text fontSize="xs" color="black.a7">
              Path
            </Text>
            <PathEditor onChange={(p) => setNewPath(p)} />
          </Stack>
          <Stack gap="1">
            <Text fontSize="xs" color="black.a7">
              Key/Value metadata
            </Text>
            <MetaKeyValueEditor
              onChange={(m) => setNewMeta(m as Record<string, string>)}
            />
          </Stack>
        </Stack>
      </Show>
      <TiptapEditor
        initialHTML={initialHTML()}
        onEditor={(ed) => setEditor(ed)}
        noteId={props.docId || doc()?.id}
        showAiPromptsMenu={shouldShowAiPromptsBar()}
      />
      <ConfirmDialog
        open={leaveDialogOpen()}
        onOpenChange={handleLeaveOpenChange}
        title="Leave without saving?"
        description="You have unsaved changes. If you leave now, they will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={handleLeaveConfirm}
      />
    </Box>
  );
};

export default DocumentEditor;
