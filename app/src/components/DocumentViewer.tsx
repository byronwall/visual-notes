import { useAction, useNavigate } from "@solidjs/router";
import { PencilIcon, Trash2Icon } from "lucide-solid";
import { type VoidComponent, Show, createEffect, createSignal } from "solid-js";
import { Box, HStack, Spacer, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { deleteDoc, updateDoc } from "~/services/docs.service";
import { logDocViewEvent } from "~/services/activity/activity.actions";
import { extractFirstHeading } from "~/utils/extractHeading";
import { DocPropertiesCompactEditors } from "./DocPropertiesCompactEditors";
import DocumentEditor, { type DocumentEditorApi } from "./DocumentEditor";
import { TitleEditPopover } from "./TitleEditPopover";

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
  const [deleteDialogOpen, setDeleteDialogOpen] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
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
  const showSync = () => firstH1() && firstH1() !== title();

  // Keep local title state aligned when client-side navigation swaps docs.
  createEffect(() => {
    const nextDocId = props.doc.id;
    const nextTitle = props.doc.title;
    void nextDocId;
    setTitle((prev) => (prev === nextTitle ? prev : nextTitle));
  });

  createEffect(() => {
    const nextDocId = props.doc.id;
    if (!nextDocId) return;
    if (nextDocId === lastLoggedDocId) return;
    lastLoggedDocId = nextDocId;
    void runLogDocViewEvent(nextDocId);
  });

  const handleCancelEdit = () => setEditing(false);
  const handleConfirmEdit = async (newTitle: string) => {
    try {
      await runUpdateDoc({ id: props.doc.id, title: newTitle });
      setTitle(newTitle);
      console.log("[DocumentViewer] title updated:", newTitle);
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
      await runUpdateDoc({ id: props.doc.id, title: newTitle });
      setTitle(newTitle);
    } catch (e) {
      alert((e as Error).message || "Failed to sync title");
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      setBusy(true);
      console.log("[DocumentViewer] deleting docId=", props.doc?.id);
      await runDeleteDoc(props.doc.id);
      console.log("[DocumentViewer] deleted docId=", props.doc?.id);
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
      <HStack gap="3" alignItems="center" flexWrap="wrap">
        <HStack gap="2" alignItems="center" flexWrap="wrap" minW="0">
          <Heading as="h1" fontSize="2xl" m="0">
            {title()}
          </Heading>
          <TitleEditPopover
            open={editing()}
            onOpenChange={(open) => {
              if (open) {
                console.log(
                  "[DocumentViewer] open title edit for doc:",
                  props.doc.id,
                );
              }
              setEditing(open);
            }}
            initialTitle={title()}
            onConfirm={handleConfirmEdit}
            onCancel={handleCancelEdit}
            trigger={
              <IconButton
                type="button"
                size="xs"
                variant="plain"
                colorPalette="gray"
                aria-label="Edit title"
              >
                <PencilIcon size={16} />
              </IconButton>
            }
          />
          <Show when={showSync()}>
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
          </Show>
        </HStack>
        <Spacer />
        <HStack gap="2" alignItems="center">
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
