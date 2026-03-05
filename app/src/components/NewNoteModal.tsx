import { useNavigate } from "@solidjs/router";
import { Show, type VoidComponent, createSignal } from "solid-js";
import DocumentEditor, {
  type DocumentEditorApi,
} from "~/components/DocumentEditor";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
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
    undefined
  );
  const getInitialFocusEl = () => {
    if (typeof document === "undefined") return null;
    const root = document.querySelector("[data-new-note-modal-content]");
    if (!(root instanceof HTMLElement)) return null;
    const editorSurface = root.querySelector(".ProseMirror");
    return editorSurface instanceof HTMLElement ? editorSurface : null;
  };

  const handleOpenChange = (open: boolean) => {
    props.onOpenChange(open);
    if (open === false) setEditorApi(undefined);
  };

  const handleCancel = () => {
    setEditorApi(undefined);
    props.onOpenChange(false);
  };

  const handleSave = () => {
    void editorApi()?.save();
  };

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
      onClose={handleCancel}
      maxW="900px"
      skipPortal={props.skipPortal}
      initialFocusEl={getInitialFocusEl}
      footer={
        <HStack justifyContent="flex-end" gap="2" w="full">
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
            onClick={handleSave}
            disabled={!canSave()}
          >
            {isSaving() ? "Saving…" : "Save"}
          </Button>
        </HStack>
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
          />
        </Box>
      </Show>
    </SimpleDialog>
  );
};
