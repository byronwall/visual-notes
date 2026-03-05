import { useAction, useNavigate } from "@solidjs/router";
import { Trash2Icon } from "lucide-solid";
import { Show, type VoidComponent, createEffect, createSignal } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { deleteDoc, updateDoc } from "~/services/docs.service";
import { logDocViewEvent } from "~/services/activity/activity.actions";
import { extractFirstHeading } from "~/utils/extractHeading";
import { DocActivitySummaryPopover } from "./DocActivitySummaryPopover";
import { DocPropertiesCompactEditors } from "./DocPropertiesCompactEditors";
import DocumentEditor, { type DocumentEditorApi } from "./DocumentEditor";
import { InPlaceEditableText } from "./InPlaceEditableText";

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
  const navigate = useNavigate();
  const [busy, setBusy] = createSignal(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = createSignal(false);
  const [editorApi, setEditorApi] = createSignal<DocumentEditorApi | undefined>(
    undefined,
  );
  const [title, setTitle] = createSignal(props.doc.title);
  const runUpdateDoc = useAction(updateDoc);
  const runDeleteDoc = useAction(deleteDoc);
  const runLogDocViewEvent = useAction(logDocViewEvent);
  let lastLoggedDocId = "";
  const firstH1 = () =>
    extractFirstHeading({
      markdown: props.doc.markdown,
      html: props.doc.html,
    }) || "";
  const showSync = () => {
    const heading = firstH1();
    return heading.length > 0 && heading !== title();
  };

  // Keep local title state aligned when client-side navigation swaps docs.
  createEffect(() => {
    setTitle(props.doc.title);
  });

  createEffect(() => {
    const nextDocId = props.doc.id;
    if (!nextDocId) return;
    if (nextDocId === lastLoggedDocId) return;
    lastLoggedDocId = nextDocId;
    void runLogDocViewEvent(nextDocId);
  });

  const handleConfirmEdit = async (nextValue: string) => {
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
      await runUpdateDoc({ id: props.doc.id, title: newTitle });
    } catch (e) {
      setTitle(previousTitle);
      alert((e as Error).message || "Failed to update title");
    }
  };
  const handleSync = async () => {
    const newTitle = firstH1();
    if (!newTitle) return;
    try {
      await runUpdateDoc({ id: props.doc.id, title: newTitle });
      setTitle(newTitle);
    } catch (e) {
      alert((e as Error).message || "Failed to sync title");
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      setBusy(true);
      await runDeleteDoc(props.doc.id);
      if (props.onDeleted) {
        try {
          props.onDeleted();
        } catch (err) {
          console.error("[DocumentViewer] onDeleted threw", err);
        }
      } else {
        navigate("/");
      }
    } catch (e) {
      console.error(e);
      alert((e as Error).message || "Failed to delete note");
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
      <HStack gap="3" alignItems="flex-start" flexWrap="nowrap">
        <Box flex="1" minW="0">
          <Show when={props.doc.id} keyed>
            {(_docId) => (
              <InPlaceEditableText
                value={title()}
                placeholder={firstH1() || "Untitled note"}
                onCommit={handleConfirmEdit}
                fontSize="4xl"
                lineHeight="1.1"
                fontWeight="semibold"
                fillWidth
                wrapPreview
                showLeadingAction={showSync()}
                leadingAction={() => (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    colorPalette="gray"
                    onClick={handleSync}
                    title={`Match H1: ${firstH1()}`}
                  >
                    Match H1
                  </Button>
                )}
              />
            )}
          </Show>
        </Box>
        <HStack gap="2" alignItems="flex-start" flexShrink="0">
          <Button
            size="sm"
            variant="outline"
            colorPalette="gray"
            disabled={!editorApi()?.canSave() || busy()}
            onClick={() => void editorApi()?.save()}
          >
            {editorApi()?.saving()
              ? "Saving…"
              : editorApi()?.dirty()
                ? "Save*"
                : "Save"}
          </Button>
          <IconButton
            size="sm"
            variant="subtle"
            colorPalette="red"
            aria-label="Delete note"
            disabled={busy()}
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2Icon size={16} />
          </IconButton>
        </HStack>
      </HStack>
      <Stack gap="3">
        <DocPropertiesCompactEditors
          docId={props.doc.id}
          initialPath={props.doc.path}
          initialMeta={props.doc.meta}
          trailing={
            <DocActivitySummaryPopover
              docId={props.doc.id}
              createdAt={props.doc.createdAt}
              updatedAt={props.doc.updatedAt}
            />
          }
        />
        <DocumentEditor
          docId={props.doc.id}
          showTitleInTopBar={false}
          showSaveButtonInTopBar={false}
          apiRef={(api) => setEditorApi(api)}
        />
      </Stack>
      <ConfirmDialog
        open={deleteDialogOpen()}
        onOpenChange={setDeleteDialogOpen}
        title="Delete this note?"
        description="This action cannot be undone."
        confirmLabel="Delete note"
        cancelLabel="Cancel"
        onConfirm={() => void handleDeleteConfirm()}
      />

      {/* Inline properties moved to page-level top section in docs/[id].tsx */}
    </Box>
  );
};

export default DocumentViewer;
