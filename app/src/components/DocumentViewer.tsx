import { useAction, useNavigate } from "@solidjs/router";
import { Trash2Icon } from "lucide-solid";
import { type VoidComponent, Show, createEffect, createSignal } from "solid-js";
import { Box, HStack, Spacer, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Editable from "~/components/ui/editable";
import { Heading } from "~/components/ui/heading";
import { IconButton } from "~/components/ui/icon-button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { deleteDoc, updateDoc } from "~/services/docs.service";
import { logDocViewEvent } from "~/services/activity/activity.actions";
import { extractFirstHeading } from "~/utils/extractHeading";
import { DocActivitySummaryPopover } from "./DocActivitySummaryPopover";
import { DocPropertiesCompactEditors } from "./DocPropertiesCompactEditors";
import DocumentEditor, { type DocumentEditorApi } from "./DocumentEditor";

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
  const [title, setTitle] = createSignal("");
  const [draftTitle, setDraftTitle] = createSignal("");
  const [titleActionVisible, setTitleActionVisible] = createSignal(false);
  let titleActionHideTimer: ReturnType<typeof setTimeout> | undefined;
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
    setDraftTitle((prev) => (prev === nextTitle ? prev : nextTitle));
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
      setDraftTitle(previousTitle);
      return;
    }
    if (newTitle === previousTitle) {
      setDraftTitle(previousTitle);
      return;
    }
    setTitle(newTitle);
    setDraftTitle(newTitle);
    try {
      await runUpdateDoc({ id: props.doc.id, title: newTitle });
    } catch (e) {
      setTitle(previousTitle);
      setDraftTitle(previousTitle);
      alert((e as Error).message || "Failed to update title");
    }
  };
  const handleSync = async () => {
    const newTitle = firstH1();
    if (!newTitle) return;
    try {
      await runUpdateDoc({ id: props.doc.id, title: newTitle });
      setTitle(newTitle);
      setDraftTitle(newTitle);
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

  const clearTitleActionHideTimer = () => {
    if (!titleActionHideTimer) return;
    clearTimeout(titleActionHideTimer);
    titleActionHideTimer = undefined;
  };

  const showTitleAction = () => {
    clearTitleActionHideTimer();
    setTitleActionVisible(true);
  };

  const hideTitleActionSoon = () => {
    clearTitleActionHideTimer();
    titleActionHideTimer = setTimeout(() => {
      setTitleActionVisible(false);
      titleActionHideTimer = undefined;
    }, 160);
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
          <Box
            position="relative"
            onMouseEnter={showTitleAction}
            onMouseLeave={hideTitleActionSoon}
            onFocusIn={showTitleAction}
            onFocusOut={(e) => {
              const next = e.relatedTarget as Node | null;
              if (!next || !e.currentTarget.contains(next)) {
                hideTitleActionSoon();
              }
            }}
          >
            <Show when={showSync()}>
              <Button
                type="button"
                size="xs"
                variant="outline"
                colorPalette="gray"
                onClick={handleSync}
                title={`Match H1: ${firstH1()}`}
                position="absolute"
                top="50%"
                zIndex="1"
                style={{
                  right: "100%",
                  transform: titleActionVisible()
                    ? "translate(-0.625rem, -50%)"
                    : "translate(-0.375rem, -50%)",
                  opacity: titleActionVisible() ? "1" : "0",
                  "pointer-events": titleActionVisible() ? "auto" : "none",
                  transition:
                    "opacity 140ms ease, transform 140ms ease, visibility 140ms ease",
                  visibility: titleActionVisible() ? "visible" : "hidden",
                }}
                onMouseEnter={showTitleAction}
                onMouseLeave={hideTitleActionSoon}
                onFocusIn={showTitleAction}
                onBlur={hideTitleActionSoon}
              >
                Match H1
              </Button>
            </Show>
            <Editable.Root
              value={draftTitle()}
              activationMode="click"
              submitMode="both"
              selectOnFocus
              onValueChange={(details) => setDraftTitle(details.value)}
              onValueCommit={(details) => void handleConfirmEdit(details.value)}
              onValueRevert={() => setDraftTitle(title())}
            >
              <HStack gap="2" alignItems="center" minW="0" flexWrap="wrap">
                <Heading as="h1" fontSize="4xl" lineHeight="1.1" m="0">
                  <Editable.Area cursor="text">
                    <Editable.Preview
                      px="0"
                      py="0"
                      borderRadius="l1"
                      cursor="pointer"
                      transitionProperty="common"
                      transitionDuration="normal"
                      _hover={{ bg: "gray.subtle", color: "fg.default" }}
                      fontSize="inherit"
                      fontWeight="inherit"
                      lineHeight="inherit"
                    />
                    <Editable.Input
                      px="0"
                      py="0"
                      bg="transparent"
                      borderRadius="0"
                      fontSize="inherit"
                      fontWeight="inherit"
                      lineHeight="inherit"
                      minW="12rem"
                    />
                  </Editable.Area>
                </Heading>
              </HStack>
            </Editable.Root>
          </Box>
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
