import { A, useAction, useNavigate } from "@solidjs/router";
import { ExternalLinkIcon, SaveIcon, Trash2Icon } from "lucide-solid";
import { Show, type VoidComponent, createEffect, createSignal } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Link } from "~/components/ui/link";
import { Tooltip } from "~/components/ui/tooltip";
import { DocSharePanel } from "./DocSharePanel";
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
  onDeleted?: () => void;
  compactChrome?: boolean;
  fullPageHref?: string;
  panelMode?: boolean;
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
              updatedAt={props.doc.updatedAt}
              iconOnly
            />
          </HStack>
        }
      >
        <HStack
          gap="3"
          alignItems="flex-start"
          flexWrap={
            props.compactChrome ? "wrap" : { base: "wrap", md: "nowrap" }
          }
        >
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
          <Stack
            gap="2"
            alignItems={{ base: "stretch", md: "flex-start" }}
            flexShrink="0"
            w={props.compactChrome ? "full" : { base: "full", md: "auto" }}
            flexDirection={
              props.compactChrome ? "column" : { base: "column", md: "row" }
            }
          >
            <DocSharePanel
              docId={props.doc.id}
              initialShare={props.doc.share}
            />
            <Button
              size="sm"
              variant="outline"
              colorPalette="gray"
              disabled={!editorApi()?.canSave() || busy()}
              onClick={() => void editorApi()?.save()}
              w={props.compactChrome ? "full" : { base: "full", md: "auto" }}
            >
              {editorApi()?.saving()
                ? "Saving…"
                : editorApi()?.dirty()
                  ? "Save*"
                  : "Save"}
            </Button>
            <Show
              when={props.compactChrome}
              fallback={
                <>
                  <Button
                    size="sm"
                    variant="subtle"
                    colorPalette="red"
                    disabled={busy()}
                    onClick={() => setDeleteDialogOpen(true)}
                    display={{ base: "inline-flex", md: "none" }}
                    w="full"
                  >
                    <Trash2Icon size={16} />
                    Delete
                  </Button>
                  <IconButton
                    size="sm"
                    variant="subtle"
                    colorPalette="red"
                    aria-label="Delete note"
                    disabled={busy()}
                    onClick={() => setDeleteDialogOpen(true)}
                    display={{ base: "none", md: "inline-flex" }}
                  >
                    <Trash2Icon size={16} />
                  </IconButton>
                </>
              }
            >
              <Button
                size="sm"
                variant="subtle"
                colorPalette="red"
                disabled={busy()}
                onClick={() => setDeleteDialogOpen(true)}
                w="full"
              >
                <Trash2Icon size={16} />
                Delete
              </Button>
            </Show>
          </Stack>
        </HStack>
      </Show>
      <Stack gap="3">
        <Show when={!props.panelMode}>
          <DocPropertiesCompactEditors
            docId={props.doc.id}
            initialPath={props.doc.path}
            initialMeta={props.doc.meta}
            trailing={
              <HStack gap="2" alignItems="center" flexWrap="wrap">
                <Show when={props.fullPageHref}>
                  {(href) => (
                    <Link
                      as={A}
                      href={href()}
                      fontSize="xs"
                      fontWeight="medium"
                      color="fg.default"
                      display="inline-flex"
                      alignItems="center"
                      gap="1.5"
                      px="3"
                      py="1.5"
                      borderWidth="1px"
                      borderColor="border"
                      borderRadius="full"
                      textDecoration="none"
                      bg="bg.default"
                      _hover={{ bg: "bg.subtle" }}
                    >
                      <ExternalLinkIcon size={12} />
                      Open full page
                    </Link>
                  )}
                </Show>
                <DocActivitySummaryPopover
                  docId={props.doc.id}
                  createdAt={props.doc.createdAt}
                  updatedAt={props.doc.updatedAt}
                />
              </HStack>
            }
          />
        </Show>
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
