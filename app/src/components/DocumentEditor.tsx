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
import { useAction, useBeforeLeave } from "@solidjs/router";
import { extractFirstH1FromHtml } from "~/utils/extractHeading";
import {
  normalizeMarkdownToHtml,
  sanitizeHtmlContent,
} from "~/server/lib/markdown";
import {
  createDoc,
  fetchDoc,
  type MetaRecord,
  updateDoc,
} from "~/services/docs.service";
import TiptapEditor from "./TiptapEditor";
import { DocPropertiesCompactEditors } from "./DocPropertiesCompactEditors";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { Box, HStack, Stack } from "styled-system/jsx";

type DocData = { id: string; title: string; markdown?: string; html?: string };

export type DocumentEditorApi = {
  save: () => Promise<void>;
  canSave: () => boolean;
  saving: () => boolean;
  dirty: () => boolean;
};

const fetchDocData = (id: string) => fetchDoc(id) as Promise<DocData>;

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

  const [doc, { mutate }] = createResource(() => props.docId, fetchDocData);
  const [newPath, setNewPath] = createSignal<string>("");
  const [newMeta, setNewMeta] = createSignal<MetaRecord>({});
  const [newTitle, setNewTitle] = createSignal(
    (props.initialTitle || "").trim() || "Untitled note"
  );
  const runCreateDoc = useAction(createDoc);
  const runUpdateDoc = useAction(updateDoc);
  let lastAppliedInitialTitle = (props.initialTitle || "").trim();

  const isNew = createMemo(() => !props.docId);

  const displayTitle = createMemo(
    () => doc()?.title || newTitle().trim() || "Untitled note"
  );

  createEffect(() => {
    const incoming = (props.initialTitle || "").trim();
    if (incoming === lastAppliedInitialTitle) return;
    lastAppliedInitialTitle = incoming;
    setNewTitle(incoming || "Untitled note");
  });

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
        if (!isEditorFocused(e.target)) return;
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

  const clampSelection = (pos: number, max: number) =>
    Math.max(0, Math.min(pos, max));

  const restoreSelection = (
    ed: Editor,
    snapshot: { from: number; to: number; wasFocused: boolean } | null
  ) => {
    if (!snapshot) return;
    const max = ed.state.doc.content.size;
    const from = clampSelection(snapshot.from, max);
    const to = clampSelection(snapshot.to, max);
    ed.commands.setTextSelection({ from, to });
    if (snapshot.wasFocused) ed.commands.focus();
  };

  const isEditorFocused = (target?: EventTarget | null) => {
    const ed = editor();
    if (!ed) return false;
    const view = (
      ed as {
        view?: { dom?: HTMLElement; hasFocus?: () => boolean };
      }
    ).view;
    const dom = view?.dom;
    if (target && dom && target instanceof Node && dom.contains(target))
      return true;
    if (view?.hasFocus?.()) return true;
    if (dom && typeof document !== "undefined") {
      const active = document.activeElement;
      if (active && dom.contains(active)) return true;
    }
    return false;
  };

  async function onSave() {
    if (saving()) return;
    const ed = editor();
    const d = doc();
    if (!ed) return;
    const selectionSnapshot = {
      from: ed.state.selection.from,
      to: ed.state.selection.to,
      wasFocused: ed.view.hasFocus(),
    };
    setSaving(true);
    setError(undefined);
    try {
      const html = ed.getHTML();
      if (isNew()) {
        // First save → create the note
        let title = newTitle().trim();
        const detected = extractFirstH1FromHtml(html);
        if (!title && detected && detected.trim().length > 0) {
          title = detected.trim();
        }
        if (!title) {
          title = "Untitled note";
        }
        console.log("[editor.save] creating new doc with title:", title);
        const json = await runCreateDoc({
          title,
          html,
          path: newPath() || undefined,
          meta: newMeta(),
        });
        console.log("[editor.save] create response", json);
        if (!json?.id) throw new Error("Failed to create note");
        setSavedAt(new Date());
        setDirty(false);
        if (props.onCreated) props.onCreated(String(json.id));
      } else {
        // Update existing
        await runUpdateDoc({ id: d!.id, html });
        setSavedAt(new Date());
        setDirty(false);
        mutate((current) => (current ? { ...current, html } : current));
      }
    } catch (e) {
      setError((e as Error).message || "Failed to save");
    } finally {
      queueMicrotask(() => restoreSelection(ed, selectionSnapshot));
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
        <Stack gap="2" mb="3">
          <Box>
            <Box as="p" fontSize="xs" color="fg.muted">
              Title
            </Box>
            <Input
              id="new-note-title"
              mt="1"
              size="sm"
              value={newTitle()}
              placeholder="Untitled note"
              onInput={(event) => setNewTitle(event.currentTarget.value)}
            />
          </Box>
          <DocPropertiesCompactEditors
            initialPath={newPath()}
            initialMeta={newMeta()}
            onPathChange={(nextPath) => setNewPath(nextPath)}
            onMetaChange={(nextMeta) => setNewMeta(nextMeta)}
          />
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
