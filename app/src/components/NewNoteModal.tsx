import { useNavigate } from "@solidjs/router";
import {
  Show,
  type VoidComponent,
  createEffect,
  createSignal,
  onCleanup,
} from "solid-js";
import DocumentEditor, {
  type DocumentEditorApi,
} from "~/components/DocumentEditor";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Text } from "~/components/ui/text";
import { Box, HStack } from "styled-system/jsx";

export type NewNoteModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skipPortal?: boolean;
  initialTitle?: string;
};

export const NewNoteModal: VoidComponent<NewNoteModalProps> = (props) => {
  const navigate = useNavigate();
  const [editorApi, setEditorApi] = createSignal<DocumentEditorApi | undefined>(
    undefined,
  );

  const [discardOpen, setDiscardOpen] = createSignal(false);

  const handleCancel = () => {
    setDiscardOpen(false);
    setEditorApi(undefined);
    props.onOpenChange(false);
  };

  const keepWriting = () => {
    setDiscardOpen(false);
    editorApi()?.focus();
  };

  // Esc and the close button can be pressed by mistake, so typed text needs a
  // second answer. Cancel is the explicit way out. The question sits in the
  // footer, because a second dialog stays hidden from screen readers here.
  const handleOpenChange = (open: boolean) => {
    if (open) props.onOpenChange(true);
    else if (discardOpen()) keepWriting();
    else if (editorApi()?.dirty()) setDiscardOpen(true);
    else handleCancel();
  };

  const handleSave = () => {
    setDiscardOpen(false);
    void editorApi()?.save();
  };

  // Capture phase: the editor binds Cmd+Enter itself, and Cmd+S must also
  // work from the path and details fields.
  createEffect(() => {
    if (!props.open) return;
    const onKey = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (key !== "enter" && key !== "s") return;
      event.preventDefault();
      event.stopPropagation();
      handleSave();
    };
    window.addEventListener("keydown", onKey, true);
    onCleanup(() => window.removeEventListener("keydown", onKey, true));
  });

  const handleCreated = (id: string) => {
    setEditorApi(undefined);
    props.onOpenChange(false);
    navigate(`/docs/${id}`);
  };

  const canSave = () => editorApi()?.canSave() ?? false;
  const isSaving = () => editorApi()?.saving() ?? false;

  const initialTitle = () => props.initialTitle?.trim() || "Untitled note";
  const initialMarkdown = () => `# ${initialTitle()}`;

  return (
    <SimpleDialog
      open={props.open}
      onOpenChange={handleOpenChange}
      maxW="900px"
      closeOnInteractOutside={false}
      showClose={false}
      phoneSheet
      skipPortal={props.skipPortal}
      footer={
        <Show
          when={discardOpen()}
          fallback={
            <HStack justifyContent="space-between" gap="2" w="full">
              <Button
                size="sm"
                variant="outline"
                colorPalette="gray"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="solid"
                colorPalette="gray"
                minW="5.5rem"
                onClick={handleSave}
                disabled={!canSave()}
              >
                {isSaving() ? "Creating…" : "Create note"}
              </Button>
            </HStack>
          }
        >
          <HStack justifyContent="space-between" gap="2" w="full">
            <Text role="alert" fontSize="sm" color="fg.default">
              Discard this note? Your text isn't saved.
            </Text>
            <HStack gap="2">
              <Button
                size="sm"
                variant="outline"
                colorPalette="gray"
                onClick={keepWriting}
              >
                Keep writing
              </Button>
              <Button
                size="sm"
                variant="solid"
                colorPalette="red"
                onClick={handleCancel}
              >
                Discard
              </Button>
            </HStack>
          </HStack>
        </Show>
      }
    >
      <Show when={props.open}>
        <Box w="full" data-new-note-modal-content>
          <DocumentEditor
            showTopBar={false}
            showAiPromptsBar={false}
            showNewDocTitleField={false}
            preferH1TitleForNewDoc
            placeNewDocPropertiesAfterEditor
            selectFirstLineOnMount
            initialTitle={initialTitle()}
            initialMarkdown={initialMarkdown()}
            onCreated={handleCreated}
            apiRef={(api) => setEditorApi(api)}
            pathPopoverPortalled={false}
          />
        </Box>
      </Show>
    </SimpleDialog>
  );
};
