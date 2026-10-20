import type { Editor, JSONContent } from "@tiptap/core";
import {
  type VoidComponent,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";
import { useBeforeLeave, useLocation, useNavigate } from "@solidjs/router";
import { revealBlock } from "./editor/core/blockLinks";
import { NOTE_LINK_NAVIGATE_EVENT } from "./editor/extensions/NoteLinkSuggestion";
import { toaster } from "~/components/ui/toast";
import { normalizeMarkdownToHtml } from "~/server/lib/markdown";
import type { NoteDoc } from "~/lib/note-content/types";
import { fetchDoc, type MetaRecord } from "~/services/docs.service";
import { fetchDocContentVersion } from "~/services/docs.queries";
import { topLevelHashes } from "~/lib/note-content/ids";
import { applyRemoteContent } from "./editor/core/applyRemoteContent";
import { useNoteMutations } from "~/hooks/useNoteMutations";
import TiptapEditor from "./TiptapEditor";
import { DocPropertiesCompactEditors } from "./DocPropertiesCompactEditors";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { Box, HStack, Stack } from "styled-system/jsx";

type DocData = {
  id: string;
  title: string;
  content: NoteDoc;
  contentVersion: number;
  updatedAt?: string;
};

export type DocumentEditorApi = {
  save: () => Promise<void>;
  canSave: () => boolean;
  saving: () => boolean;
  dirty: () => boolean;
  error: () => string | undefined;
};

// Quiet period after the last keystroke before an autosave fires.
const AUTOSAVE_DELAY_MS = 1500;

const fetchDocData = (id: string) => fetchDoc(id) as Promise<DocData>;

// Reads the first H1 straight from the editor state so entities and marks
// never leak into the title the way regex-on-HTML would.
const firstH1Text = (ed: Editor) => {
  let text: string | undefined;
  ed.state.doc.descendants((node) => {
    if (text !== undefined) return false;
    if (node.type.name === "heading" && node.attrs.level === 1) {
      text = node.textContent.replace(/\s+/g, " ").trim();
      return false;
    }
    return true;
  });
  return text || undefined;
};

const DocumentEditor: VoidComponent<{
  docId?: string;
  class?: string;
  initialTitle?: string;
  initialMarkdown?: string;
  initialHTML?: string;
  onCreated?: (id: string) => void;
  onSaved?: (result: { id: string; updatedAt: string }) => void;
  apiRef?: (api: DocumentEditorApi) => void;
  showTopBar?: boolean;
  showAiPromptsBar?: boolean;
  showTitleInTopBar?: boolean;
  showSaveButtonInTopBar?: boolean;
  showNewDocTitleField?: boolean;
  preferH1TitleForNewDoc?: boolean;
  placeNewDocPropertiesAfterEditor?: boolean;
  selectFirstLineOnMount?: boolean;
  /** Focus the start of the document once the editor mounts. */
  focusOnMount?: boolean;
  pathPopoverPortalled?: boolean;
  /** Save existing docs automatically after a short pause in typing. */
  autosave?: boolean;
  /** Hide the inline error box when the host renders save errors itself. */
  hideInlineError?: boolean;
  /**
   * When true, saves also send the leading H1 as the title so a note whose
   * title mirrors its first heading stays in sync while editing.
   */
  syncTitleFromH1?: boolean;
  onTitleSynced?: (title: string) => void;
  minEditorHeight?: string;
  borderless?: boolean;
  phoneToolbar?: "inline" | "keyboard";
}> = (props) => {
  const [editor, setEditor] = createSignal<Editor | undefined>(undefined);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [dirty, setDirty] = createSignal(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = createSignal(false);
  const [pendingRetry, setPendingRetry] = createSignal<(() => void) | null>(
    null,
  );
  let isMounted = true;
  onCleanup(() => {
    isMounted = false;
  });

  const [doc, { mutate }] = createResource(() => props.docId, fetchDocData);
  const [newPath, setNewPath] = createSignal<string>("");
  const [newMeta, setNewMeta] = createSignal<MetaRecord>({});
  const [newTitle, setNewTitle] = createSignal(
    (props.initialTitle || "").trim() || "Untitled note",
  );
  const { create: runCreateDoc, saveContent: runSaveContent } =
    useNoteMutations();
  let lastAppliedInitialTitle = (props.initialTitle || "").trim();
  let hasAppliedInitialLineSelection = false;

  const isNew = createMemo(() => !props.docId);

  const displayTitle = createMemo(
    () => doc()?.title || newTitle().trim() || "Untitled note",
  );

  createEffect(() => {
    const incoming = (props.initialTitle || "").trim();
    if (incoming === lastAppliedInitialTitle) return;
    lastAppliedInitialTitle = incoming;
    setNewTitle(incoming || "Untitled note");
  });

  // Existing notes load their blocks; new notes start from HTML/markdown.
  const initialContent = createMemo(
    () => doc()?.content as JSONContent | undefined,
  );

  // The stored version this editor last agreed with. Saves send it so the
  // server can merge per block when another tab or ChatGPT wrote since.
  let base: { docId: string; version: number; hashes: Record<string, string> } | null =
    null;
  const setBase = (docId: string, version: number, content: NoteDoc) => {
    base = { docId, version, hashes: topLevelHashes(content) };
  };
  createEffect(() => {
    const d = doc();
    if (!d || base?.docId === d.id) return;
    setBase(d.id, d.contentVersion, d.content);
  });

  // A merged or remote version waiting for the cursor to leave its block.
  let pendingRemote: NoteDoc | null = null;
  const adoptRemote = (ed: Editor, docId: string, version: number, next: NoteDoc) => {
    const result = applyRemoteContent(ed, next as JSONContent, {
      deferIfCursorInside: true,
    });
    if (result === "deferred") {
      pendingRemote = next;
      return false;
    }
    pendingRemote = null;
    setBase(docId, version, next);
    mutate((current) =>
      current?.id === docId ? { ...current, content: next, contentVersion: version } : current,
    );
    return true;
  };

  createEffect(() => {
    const ed = editor();
    if (!ed) return;
    const onBlur = () => {
      const d = doc();
      if (!pendingRemote || !d || dirty()) return;
      if (base) adoptRemote(ed, d.id, base.version, pendingRemote);
    };
    ed.on("blur", onBlur);
    onCleanup(() => ed.off("blur", onBlur));
  });

  // Pick up edits made elsewhere while this editor sits idle.
  const REMOTE_POLL_MS = 15000;
  createEffect(() => {
    const ed = editor();
    if (!ed || !props.autosave || isNew()) return;
    const timer = setInterval(async () => {
      const d = doc();
      if (!d || !base || document.visibilityState !== "visible") return;
      if (dirty() || saving()) return;
      try {
        const version = await fetchDocContentVersion(d.id);
        if (version === null || version <= base.version) return;
        const fresh = await fetchDoc(d.id);
        if (dirty() || saving() || editor() !== ed || ed.isDestroyed) return;
        console.info("[doc-editor] applying remote version", version);
        adoptRemote(ed, d.id, fresh.contentVersion, fresh.content);
      } catch (e) {
        console.debug("[doc-editor] remote check failed", e);
      }
    }, REMOTE_POLL_MS);
    onCleanup(() => clearInterval(timer));
  });

  const initialHTML = createMemo(() => {
    if (props.initialHTML) return props.initialHTML;

    const html = normalizeMarkdownToHtml(
      props.initialMarkdown || "# Untitled\n\nStart writing...",
    );

    return html;
  });

  // Note links dispatch a window event; navigate in-app instead of reloading.
  const navigate = useNavigate();
  createEffect(() => {
    if (!editor()) return;
    const onNavigate = (e: Event) => {
      const href = (e as CustomEvent<string>).detail;
      if (href) navigate(href);
    };
    window.addEventListener(NOTE_LINK_NAVIGATE_EVENT, onNavigate);
    onCleanup(() =>
      window.removeEventListener(NOTE_LINK_NAVIGATE_EVENT, onNavigate),
    );
  });

  // `#b-<blockId>` scrolls to and flashes that block once the note loads.
  const location = useLocation();
  let revealedKey = "";
  createEffect(() => {
    const ed = editor();
    const d = doc();
    const hash = location.hash;
    if (!ed || !d || !hash.startsWith("#b-")) return;
    const key = `${d.id}${hash}`;
    if (key === revealedKey) return;
    revealedKey = key;
    setTimeout(() => {
      if (ed.isDestroyed) return;
      if (!revealBlock(ed.view.dom, hash)) {
        toaster.create({
          title: "That block is no longer in this note",
          type: "info",
        });
      }
    }, 60);
  });

  let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  const clearAutosave = () => {
    if (!autosaveTimer) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = undefined;
  };
  const scheduleAutosave = () => {
    if (!props.autosave || isNew()) return;
    clearAutosave();
    autosaveTimer = setTimeout(() => {
      autosaveTimer = undefined;
      if (!dirty()) return;
      if (saving()) {
        scheduleAutosave();
        return;
      }
      void onSave();
    }, AUTOSAVE_DELAY_MS);
  };
  onCleanup(clearAutosave);

  // Track editor updates to mark dirty
  createEffect(() => {
    const ed = editor();
    if (!ed) return;
    const handler = () => {
      setDirty(true);
      scheduleAutosave();
    };
    ed.on("update", handler);
    onCleanup(() => {
      ed.off("update", handler);
    });
  });

  // Flush pending edits when the tab is hidden so switching away never
  // strands unsaved text.
  createEffect(() => {
    if (!props.autosave) return;
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      if (!dirty() || saving() || isNew()) return;
      clearAutosave();
      void onSave();
    };
    document.addEventListener("visibilitychange", onVisibility);
    onCleanup(() =>
      document.removeEventListener("visibilitychange", onVisibility),
    );
  });

  createEffect(() => {
    const ed = editor();
    if (!ed || !props.focusOnMount) return;
    queueMicrotask(() => {
      if (ed.isDestroyed) return;
      ed.commands.focus("start");
    });
  });

  // Intercept Cmd+S / Ctrl+S to save
  createEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const isSave =
        (isMac && e.metaKey && e.key.toLowerCase() === "s") ||
        (!isMac && e.ctrlKey && e.key.toLowerCase() === "s");
      if (isSave) {
        // With autosave on, Cmd+S anywhere on the page flushes the draft
        // instead of opening the browser's "Save page" dialog.
        if (!props.autosave && !isEditorFocused(e.target)) return;
        e.preventDefault();
        clearAutosave();
        void onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  createEffect(() => {
    const ed = editor();
    if (!ed) return;
    if (props.selectFirstLineOnMount !== true) return;
    if (hasAppliedInitialLineSelection) return;
    queueMicrotask(() => {
      if (hasAppliedInitialLineSelection) return;
      const { doc: pmDoc } = ed.state;
      let selectionRange: { from: number; to: number } | null = null;
      pmDoc.descendants((node, pos) => {
        if (selectionRange) return false;
        if (!node.isTextblock) return true;
        if (!node.textContent.trim()) return true;
        const from = pos + 1;
        const to = from + node.content.size;
        selectionRange = { from, to };
        return false;
      });
      if (!selectionRange) return;
      ed.commands.focus();
      ed.commands.setTextSelection(selectionRange);
      hasAppliedInitialLineSelection = true;
    });
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

  const getEditorView = (ed: Editor) =>
    (
      ed as {
        view?: { dom?: HTMLElement; hasFocus?: () => boolean };
        isDestroyed?: boolean;
      }
    ).view;

  const hasMountedEditorView = (ed: Editor) => {
    if ((ed as { isDestroyed?: boolean }).isDestroyed) return false;
    const dom = getEditorView(ed)?.dom;
    return dom instanceof HTMLElement && dom.isConnected;
  };

  const getEditorFocusState = (ed: Editor) => {
    const view = getEditorView(ed);
    if (!view) return false;
    try {
      return view.hasFocus?.() ?? false;
    } catch {
      return false;
    }
  };

  const clampSelection = (pos: number, max: number) =>
    Math.max(0, Math.min(pos, max));

  const restoreSelection = (
    ed: Editor,
    snapshot: { from: number; to: number; wasFocused: boolean } | null,
  ) => {
    if (!snapshot) return;
    if (!hasMountedEditorView(ed)) return;
    const max = ed.state.doc.content.size;
    const from = clampSelection(snapshot.from, max);
    const to = clampSelection(snapshot.to, max);
    ed.commands.setTextSelection({ from, to });
    if (snapshot.wasFocused) {
      try {
        ed.commands.focus();
      } catch {
        // Navigation/unmount can destroy the editor between save completion and
        // queued selection restoration. Treat that as a no-op.
      }
    }
  };

  const isEditorFocused = (target?: EventTarget | null) => {
    const ed = editor();
    if (!ed) return false;
    const view = getEditorView(ed);
    const dom = view?.dom;
    if (target && dom && target instanceof Node && dom.contains(target))
      return true;
    if (getEditorFocusState(ed)) return true;
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
    let shouldRestoreSelection = true;
    const selectionSnapshot = {
      from: ed.state.selection.from,
      to: ed.state.selection.to,
      wasFocused: getEditorFocusState(ed),
    };
    const submittedDocId = d?.id;
    const submittedContent = ed.getJSON();
    const submittedKey = JSON.stringify(submittedContent);
    const draftKey = () => JSON.stringify(ed.getJSON());
    setSaving(true);
    setError(undefined);
    try {
      const content = submittedContent;
      if (isNew()) {
        // First save → create the note
        let title = newTitle().trim();
        const detected = firstH1Text(ed);
        if (
          props.preferH1TitleForNewDoc &&
          detected &&
          detected.trim().length > 0
        ) {
          title = detected.trim();
        }
        if (!title && detected && detected.trim().length > 0) {
          title = detected.trim();
        }
        if (!title) {
          title = "Untitled note";
        }
        const json = await runCreateDoc({
          title,
          content,
          path: newPath() || undefined,
          meta: newMeta(),
        });
        if (!isMounted) return;
        setDirty(false);
        shouldRestoreSelection = false;
        if (props.onCreated) props.onCreated(json.id);
      } else {
        // Update existing
        const syncedTitle = props.syncTitleFromH1 ? firstH1Text(ed) : undefined;
        const titleChanged =
          !!syncedTitle && syncedTitle !== (d!.title || "").trim();
        const saveBase = base?.docId === d!.id ? base : null;
        const updated = await runSaveContent({
          id: d!.id,
          content,
          ...(saveBase
            ? { baseVersion: saveBase.version, baseHashes: saveBase.hashes }
            : {}),
          ...(titleChanged ? { title: syncedTitle } : {}),
        });
        if (titleChanged && syncedTitle) {
          mutate((current) =>
            current?.id === updated.id
              ? { ...current, title: syncedTitle }
              : current,
          );
          props.onTitleSynced?.(syncedTitle);
        }
        if (props.docId === updated.id && doc()?.id === updated.id) {
          const draftUnchanged =
            editor() === ed && !ed.isDestroyed && draftKey() === submittedKey;
          if (updated.mergedContent) {
            // Someone else wrote since our base. Show the merged result when
            // the draft has not moved on; otherwise keep the old base so the
            // next save merges again.
            if (draftUnchanged) {
              adoptRemote(ed, updated.id, updated.contentVersion, updated.mergedContent);
              setDirty(false);
            }
            if (updated.conflicts.length) {
              toaster.create({
                title: "Merged with changes made elsewhere",
                description:
                  "A paragraph you edited was also changed elsewhere; the other version is in Versions.",
                type: "info",
              });
            }
            props.onSaved?.(updated);
            return;
          }
          setBase(updated.id, updated.contentVersion, content as NoteDoc);
          if (draftUnchanged) setDirty(false);
          mutate((current) =>
            current?.id === updated.id
              ? {
                  ...current,
                  ...(draftUnchanged
                    ? { content: content as NoteDoc }
                    : {}),
                  contentVersion: updated.contentVersion,
                  updatedAt: updated.updatedAt,
                }
              : current,
          );
          props.onSaved?.(updated);
        }
      }
    } catch (e) {
      setError((e as Error).message || "Failed to save");
    } finally {
      if (shouldRestoreSelection) {
        queueMicrotask(() => {
          const sameDoc =
            !submittedDocId ||
            (props.docId === submittedDocId && doc()?.id === submittedDocId);
          if (
            !sameDoc ||
            editor() !== ed ||
            ed.isDestroyed ||
            draftKey() !== submittedKey
          ) {
            return;
          }
          if (
            ed.state.selection.from === selectionSnapshot.from &&
            ed.state.selection.to === selectionSnapshot.to &&
            getEditorFocusState(ed) === selectionSnapshot.wasFocused
          ) {
            restoreSelection(ed, selectionSnapshot);
          }
        });
      }
      setSaving(false);
      // Edits made while the request was in flight still need a save.
      if (dirty() && !error()) scheduleAutosave();
    }
  }

  if (props.apiRef) {
    props.apiRef({
      save: onSave,
      canSave,
      saving,
      dirty,
      error,
    });
  }

  const shouldShowTopBar = () => props.showTopBar !== false;
  const shouldShowAiPromptsBar = () => props.showAiPromptsBar !== false;
  const shouldShowTitleInTopBar = () => props.showTitleInTopBar !== false;
  const shouldShowSaveButtonInTopBar = () =>
    props.showSaveButtonInTopBar !== false;
  const shouldShowNewDocTitleField = () => props.showNewDocTitleField !== false;
  const shouldPlaceNewDocPropertiesAfterEditor = () =>
    props.placeNewDocPropertiesAfterEditor === true;
  const shouldShowNewDocPropertiesBeforeEditor = () =>
    isNew() && !shouldPlaceNewDocPropertiesAfterEditor();
  const shouldShowNewDocPropertiesAfterEditor = () =>
    isNew() && shouldPlaceNewDocPropertiesAfterEditor();

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
      <Show when={!props.hideInlineError && error()}>
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
      <Show when={isNew() && shouldShowNewDocTitleField()}>
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
        </Stack>
      </Show>
      <Show when={shouldShowNewDocPropertiesBeforeEditor()}>
        <Stack gap="2" mb="3">
          <DocPropertiesCompactEditors
            initialPath={newPath()}
            initialMeta={newMeta()}
            onPathChange={(nextPath) => setNewPath(nextPath)}
            onMetaChange={(nextMeta) => setNewMeta(nextMeta)}
            pathPopoverPortalled={props.pathPopoverPortalled}
          />
        </Stack>
      </Show>
      <TiptapEditor
        initialHTML={initialHTML()}
        initialContent={initialContent()}
        onEditor={(ed) => setEditor(ed)}
        noteId={props.docId || doc()?.id}
        showAiPromptsMenu={shouldShowAiPromptsBar()}
        minEditorHeight={props.minEditorHeight}
        borderless={props.borderless}
        phoneToolbar={props.phoneToolbar}
      />
      <Show when={shouldShowNewDocPropertiesAfterEditor()}>
        <Stack gap="2" mt="3">
          <DocPropertiesCompactEditors
            initialPath={newPath()}
            initialMeta={newMeta()}
            onPathChange={(nextPath) => setNewPath(nextPath)}
            onMetaChange={(nextMeta) => setNewMeta(nextMeta)}
            pathPopoverPortalled={props.pathPopoverPortalled}
          />
        </Stack>
      </Show>
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
