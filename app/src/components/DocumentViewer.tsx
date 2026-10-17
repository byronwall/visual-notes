import { A, useAction, useNavigate } from "@solidjs/router";
import { ExternalLinkIcon, SaveIcon, Trash2Icon } from "lucide-solid";
import {
  Show,
  type VoidComponent,
  createEffect,
  createSignal,
  onCleanup,
  untrack,
} from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { IconButton } from "~/components/ui/icon-button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Link } from "~/components/ui/link";
import { Tooltip } from "~/components/ui/tooltip";
import { DocSharePanel } from "./DocSharePanel";
import { useNoteMutations } from "~/hooks/useNoteMutations";
import { logDocViewEvent } from "~/services/activity/activity.actions";
import { extractFirstHeading } from "~/utils/extractHeading";
import { DocActivitySummaryPopover } from "./DocActivitySummaryPopover";
import { DocPropertiesCompactEditors } from "./DocPropertiesCompactEditors";
import DocumentEditor, { type DocumentEditorApi } from "./DocumentEditor";
import { InPlaceEditableText } from "./InPlaceEditableText";
import { useToasts } from "./Toast";
import { DocActionsMenu } from "./doc-header/DocActionsMenu";
import { DocSaveStatus, type SaveState } from "./doc-header/DocSaveStatus";
import { leadingH1Text, titlesMatch } from "./doc-header/leading-heading";
import { normalizeMarkdownToHtml } from "~/server/lib/markdown";

type DocumentData = {
  id: string;
  title: string;
  markdown?: string;
  html?: string;
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
  fullPageHref?: string;
  panelMode?: boolean;
}> = (props) => {
  const navigate = useNavigate();
  const [busy, setBusy] = createSignal(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = createSignal(false);
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
  const firstH1 = () =>
    extractFirstHeading({
      markdown: props.doc.markdown,
      html: props.doc.html,
    }) || "";
  const showSync = () => {
    const heading = firstH1();
    return heading.length > 0 && heading !== title();
  };
  const leadingHeading = () =>
    leadingH1Text(
      props.doc.html || normalizeMarkdownToHtml(props.doc.markdown || ""),
    );
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

  return (
    <Box class="prose" maxW="none">
      <Show
        when={!props.panelMode}
        fallback={
          <HStack gap="2" alignItems="center" flexWrap="wrap" mb="3">
            <DocSharePanel
              docId={props.doc.id}
              initialShare={props.doc.share}
              iconOnly
            />
            <Tooltip
              content={editorApi()?.dirty() ? "Save changes" : "Save note"}
              showArrow
              portalled={false}
              contentProps={{ zIndex: "tooltip" }}
            >
              <IconButton
                size="sm"
                variant="outline"
                colorPalette="gray"
                aria-label={
                  editorApi()?.dirty() ? "Save note changes" : "Save note"
                }
                disabled={!editorApi()?.canSave() || busy()}
                onClick={() => void editorApi()?.save()}
              >
                <SaveIcon size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip
              content="Delete note"
              showArrow
              portalled={false}
              contentProps={{ zIndex: "tooltip" }}
            >
              <IconButton
                size="sm"
                variant="subtle"
                colorPalette="red"
                aria-label="Delete note"
                disabled={busy()}
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2Icon size={14} />
              </IconButton>
            </Tooltip>
            <Show when={props.fullPageHref}>
              {(href) => (
                <Tooltip
                  content="Open full page"
                  showArrow
                  portalled={false}
                  contentProps={{ zIndex: "tooltip" }}
                >
                  <Link
                    as={A}
                    href={href()}
                    aria-label="Open full page"
                    display="inline-flex"
                    alignItems="center"
                    justifyContent="center"
                    boxSize="9"
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="l2"
                    textDecoration="none"
                    color="fg.default"
                    bg="bg.default"
                    _hover={{ bg: "bg.subtle" }}
                  >
                    <ExternalLinkIcon size={14} />
                  </Link>
                </Tooltip>
              )}
            </Show>
            <DocActivitySummaryPopover
              docId={props.doc.id}
              createdAt={props.doc.createdAt}
              updatedAt={savedUpdatedAt()}
              iconOnly
            />
          </HStack>
        }
      >
        <HStack
          gap="2"
          rowGap="1"
          alignItems="flex-start"
          justifyContent="space-between"
          flexWrap={{ base: "wrap", md: "nowrap" }}
          mb="2"
        >
          <Box flex="1" minW="0" display={{ base: "contents", md: "block" }}>
            <DocPropertiesCompactEditors
              docId={props.doc.id}
              initialPath={props.doc.path}
              initialMeta={props.doc.meta}
            />
          </Box>
          <HStack
            gap="0.5"
            flexShrink="0"
            alignItems="center"
            order="1"
            ml="auto"
          >
            <DocActivitySummaryPopover
              docId={props.doc.id}
              createdAt={props.doc.createdAt}
              updatedAt={savedUpdatedAt()}
              renderTrigger={(trigger) => (
                <DocSaveStatus
                  state={saveState()}
                  onClick={trigger.onClick}
                  ariaLabel={trigger.ariaLabel}
                  onRetry={() => void editorApi()?.save()}
                />
              )}
            />
            <DocSharePanel
              docId={props.doc.id}
              initialShare={props.doc.share}
              iconOnly
            />
            <DocActionsMenu
              disabled={busy()}
              onDelete={() => setDeleteDialogOpen(true)}
              onCopyLink={() => void handleCopyLink()}
              headingTitle={showSync() ? firstH1() : undefined}
              onUseHeadingTitle={() => void handleSync()}
            />
          </HStack>
        </HStack>
        <Show when={!titleLinked()}>
          <Show when={props.doc.id} keyed>
            {(_docId) => (
              <Box mb="4">
                <InPlaceEditableText
                  value={title()}
                  placeholder={firstH1() || "Untitled note"}
                  onCommit={handleConfirmEdit}
                  fontSize="3xl"
                  lineHeight="1.15"
                  fontWeight="bold"
                  fillWidth
                  wrapPreview
                />
              </Box>
            )}
          </Show>
        </Show>
      </Show>
      <DocumentEditor
        docId={props.doc.id}
        showTopBar={false}
        borderless
        autosave
        hideInlineError={!props.panelMode}
        syncTitleFromH1={titleLinked()}
        onTitleSynced={setTitle}
        minEditorHeight={props.panelMode ? undefined : "50vh"}
        apiRef={(api) => {
          setEditorApi(api);
          props.onEditorApiChange?.(props.doc.id, api);
        }}
        onSaved={handleContentSaved}
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
