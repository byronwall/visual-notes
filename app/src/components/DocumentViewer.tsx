import { useAction, useNavigate } from "@solidjs/router";
import {
  type JSX,
  Show,
  type VoidComponent,
  createEffect,
  createSignal,
  onCleanup,
  untrack,
} from "solid-js";
import { Box } from "styled-system/jsx";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { useNoteMutations } from "~/hooks/useNoteMutations";
import { logDocViewEvent } from "~/services/activity/activity.actions";
import {
  firstHeadingText,
  leadingHeadingText,
} from "~/lib/note-content/markdown";
import { DocAudioStrip } from "./doc-audio/DocAudioStrip";
import { DocCollectionHeader } from "./collections/DocCollectionHeader";
import { AddToCollectionDialog } from "./collections/membership/NoteCollectionMenu";
import DocumentEditor, { type DocumentEditorApi } from "./DocumentEditor";
import { BacklinksSection } from "./docs/BacklinksSection";
import { useToasts } from "./Toast";
import { DocHeaderBar } from "./doc-header/DocHeaderBar";
import { type SaveState } from "./doc-header/DocSaveStatus";
import { DocTitleField } from "./doc-header/DocTitleField";
import { titlesMatch } from "./doc-header/leading-heading";
import type { NoteDoc } from "~/lib/note-content/types";

type DocumentData = {
  id: string;
  title: string;
  content: NoteDoc;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  share?: {
    id: string;
    slug: string;
    shareUrl: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

const DocumentViewer: VoidComponent<{
  doc: DocumentData;
  onDeleted?: (docId: string) => void;
  onEditorApiChange?: (docId: string, api?: DocumentEditorApi) => void;
  /** Side-panel layout: pinned header, inline phone toolbar, no min height. */
  panelMode?: boolean;
  /** Host controls at the end of the header row, e.g. a panel's close. */
  headerTrailing?: JSX.Element;
  /** Replaces the collection header under the title, e.g. a row's properties. */
  subheader?: JSX.Element;
  /** Called after the note's title is saved or follows its first heading. */
  onTitleChange?: (docId: string, title: string) => void;
}> = (props) => {
  const navigate = useNavigate();
  const [busy, setBusy] = createSignal(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = createSignal(false);
  const [addToCollectionOpen, setAddToCollectionOpen] = createSignal(false);
  const [editorApi, setEditorApi] = createSignal<DocumentEditorApi | undefined>(
    undefined,
  );
  const docId = untrack(() => props.doc.id);
  let currentDocId = untrack(() => props.doc.id);
  let docGeneration = 0;
  let ownerActive = true;
  onCleanup(() => {
    ownerActive = false;
    props.onEditorApiChange?.(docId);
  });
  const [title, setTitle] = createSignal(props.doc.title);
  const [savedUpdatedAt, setSavedUpdatedAt] = createSignal(props.doc.updatedAt);
  let savedDocId = props.doc.id;
  const { update: runUpdateDoc, delete: runDeleteDoc } = useNoteMutations();
  const runLogDocViewEvent = useAction(logDocViewEvent);
  const { show: showToast } = useToasts();
  let lastLoggedDocId = "";
  const isCurrentVisit = (id: string, generation: number) =>
    ownerActive && props.doc.id === id && docGeneration === generation;
  const firstH1 = () => firstHeadingText(props.doc.content) || "";
  const showSync = () => {
    const heading = firstH1();
    return heading.length > 0 && heading !== title();
  };
  const leadingHeading = () => leadingHeadingText(props.doc.content);
  // When the note opens with an H1 that matches its title, that heading *is*
  // the title: the page skips the duplicate display title and edits to the
  // heading keep the stored title in sync.
  const [titleLinked, setTitleLinked] = createSignal(
    titlesMatch(leadingHeading(), props.doc.title),
  );
  const saveState = (): SaveState => ({
    saving: editorApi()?.saving() ?? false,
    dirty: editorApi()?.dirty() ?? false,
    error: editorApi()?.error(),
    updatedAt: savedUpdatedAt(),
  });

  // Keep local title state aligned when client-side navigation swaps docs.
  createEffect(() => {
    const nextDocId = props.doc.id;
    if (nextDocId !== currentDocId) {
      currentDocId = nextDocId;
      docGeneration += 1;
      setTitleLinked(
        titlesMatch(
          leadingHeading(),
          untrack(() => props.doc.title),
        ),
      );
    }
    setTitle(props.doc.title);
  });

  createEffect(() => {
    const id = props.doc.id;
    const updatedAt = props.doc.updatedAt;
    if (id !== savedDocId) {
      savedDocId = id;
      setSavedUpdatedAt(updatedAt);
    } else if (updatedAt) {
      const incomingTime = Date.parse(updatedAt);
      const savedTime = Date.parse(savedUpdatedAt() || "");
      if (
        Number.isFinite(incomingTime) &&
        (!Number.isFinite(savedTime) || incomingTime > savedTime)
      ) {
        setSavedUpdatedAt(updatedAt);
      }
    }
  });

  const handleContentSaved = (result: { id: string; updatedAt: string }) => {
    if (props.doc.id !== result.id) return;
    setSavedUpdatedAt((current) =>
      Date.parse(current || "") >= Date.parse(result.updatedAt)
        ? current
        : result.updatedAt,
    );
  };

  createEffect(() => {
    const nextDocId = props.doc.id;
    if (!nextDocId) return;
    if (nextDocId === lastLoggedDocId) return;
    lastLoggedDocId = nextDocId;
    void runLogDocViewEvent(nextDocId);
  });

  const handleConfirmEdit = async (nextValue: string) => {
    const editDocId = props.doc.id;
    const editGeneration = docGeneration;
    const newTitle = nextValue.trim();
    const previousTitle = title();
    if (!newTitle) {
      return;
    }
    if (newTitle === previousTitle) {
      return;
    }
    setTitle(newTitle);
    try {
      await runUpdateDoc({ id: editDocId, title: newTitle });
      props.onTitleChange?.(editDocId, newTitle);
    } catch (error) {
      if (isCurrentVisit(editDocId, editGeneration)) {
        setTitle(previousTitle);
      }
      throw error;
    }
  };
  const handleSync = async () => {
    const syncDocId = props.doc.id;
    const syncGeneration = docGeneration;
    const newTitle = firstH1();
    if (!newTitle) return;
    try {
      await runUpdateDoc({ id: syncDocId, title: newTitle });
      props.onTitleChange?.(syncDocId, newTitle);
      if (isCurrentVisit(syncDocId, syncGeneration)) {
        setTitle(newTitle);
        if (titlesMatch(leadingHeading(), newTitle)) setTitleLinked(true);
      }
    } catch (e) {
      if (isCurrentVisit(syncDocId, syncGeneration)) {
        alert((e as Error).message || "Failed to sync title");
      }
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/docs/${props.doc.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast({ title: "Link copied", message: url });
    } catch (error) {
      console.warn("[DocumentViewer] copy link failed", error);
    }
  };

  const handleDeleteConfirm = async () => {
    const deletedDocId = props.doc.id;
    const deleteGeneration = docGeneration;
    try {
      setBusy(true);
      await runDeleteDoc(deletedDocId);
      if (props.onDeleted) {
        try {
          props.onDeleted(deletedDocId);
        } catch (err) {
          console.error("[DocumentViewer] onDeleted threw", err);
        }
      } else {
        if (props.doc.id === deletedDocId) navigate("/");
      }
    } catch (e) {
      console.error(e);
      if (isCurrentVisit(deletedDocId, deleteGeneration)) {
        alert((e as Error).message || "Failed to delete note");
      }
    } finally {
      setBusy(false);
    }
  };

  // Update page title to match note title
  createEffect(() => {
    const t = title();
    if (typeof document !== "undefined" && t) {
      document.title = `${t} • Visual Notes`;
    }
  });

  const flushEditorChanges = async () => {
    const api = editorApi();
    if (api?.dirty()) await api.save();
  };

  const header = () => (
    <DocHeaderBar
      doc={props.doc}
      saveState={saveState()}
      busy={busy()}
      stacked={props.panelMode}
      onSave={() => void editorApi()?.save()}
      onBeforeRestore={flushEditorChanges}
      onDelete={() => setDeleteDialogOpen(true)}
      onCopyLink={() => void handleCopyLink()}
      headingTitle={showSync() ? firstH1() : undefined}
      onUseHeadingTitle={() => void handleSync()}
      onAddToCollection={() => setAddToCollectionOpen(true)}
      trailing={props.headerTrailing}
    />
  );

  return (
    <Box class="prose" maxW="none">
      <Show
        when={props.panelMode}
        fallback={<Box mb="2">{header()}</Box>}
      >
        {/* The panel scrolls inside itself, so its header stays pinned with
            the close button in reach. */}
        <Box
          position="sticky"
          top="0"
          zIndex="docked"
          mx="-5"
          px="5"
          pt="3"
          pb="2"
          mb="1"
          bg="bg.default"
        >
          {header()}
        </Box>
      </Show>
      <Show when={!titleLinked()}>
        <Show when={props.doc.id} keyed>
          {(_docId) => (
            <DocTitleField
              value={title()}
              placeholder={firstH1() || "Untitled note"}
              onCommit={handleConfirmEdit}
            />
          )}
        </Show>
      </Show>
      {props.subheader ?? <DocCollectionHeader docId={props.doc.id} />}
      <DocAudioStrip docId={props.doc.id} />
      <DocumentEditor
        docId={props.doc.id}
        showTopBar={false}
        borderless
        autosave
        phoneToolbar={props.panelMode ? "inline" : "keyboard"}
        hideInlineError={!props.panelMode}
        syncTitleFromH1={titleLinked()}
        onTitleSynced={(next) => {
          setTitle(next);
          props.onTitleChange?.(props.doc.id, next);
        }}
        minEditorHeight={props.panelMode ? undefined : "50vh"}
        apiRef={(api) => {
          setEditorApi(api);
          props.onEditorApiChange?.(props.doc.id, api);
        }}
        onSaved={handleContentSaved}
      />
      <BacklinksSection docId={props.doc.id} />
      <AddToCollectionDialog
        open={addToCollectionOpen()}
        docId={props.doc.id}
        onClose={() => setAddToCollectionOpen(false)}
      />
      <ConfirmDialog
        open={deleteDialogOpen()}
        onOpenChange={setDeleteDialogOpen}
        title="Delete this note?"
        description="This action cannot be undone."
        confirmLabel="Delete note"
        cancelLabel="Cancel"
        onConfirm={() => void handleDeleteConfirm()}
      />
    </Box>
  );
};

export default DocumentViewer;
