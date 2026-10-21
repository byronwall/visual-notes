import {
  type JSX,
  Show,
  Suspense,
  createResource,
  createEffect,
  createSignal,
  untrack,
  type VoidComponent,
} from "solid-js";
import { Box, Flex } from "styled-system/jsx";
import { CloseButton } from "~/components/ui/close-button";
import { Text } from "~/components/ui/text";
import { SidePanel } from "./SidePanel";
import DocumentViewer from "./DocumentViewer";
import { NoteEventSection } from "./events/note/NoteEventSection";
import { useLiveNoteResource } from "~/features/live-sync/useLiveNoteResource";
import { InPlaceEditableText } from "./InPlaceEditableText";
import { fetchDoc, fetchDocLatest } from "~/services/docs.service";
import { useNoteMutations } from "~/hooks/useNoteMutations";
import type { DocumentEditorApi } from "./DocumentEditor";

import type { NoteDoc } from "~/lib/note-content/types";

type DocDetail = {
  id: string;
  title: string;
  content: NoteDoc;
  createdAt?: string;
  updatedAt?: string;
};

const fetchDocDetail = (id: string) => fetchDoc(id) as Promise<DocDetail>;

export const DocumentSidePanel: VoidComponent<{
  open: boolean;
  docId?: string;
  onClose: () => void;
  onDeleted: (docId: string) => void;
  onEditorApiChange?: (docId: string, api?: DocumentEditorApi) => void;
  /** Leave the page behind interactive (default: modal). */
  modal?: boolean;
  width?: string;
  /** Rendered above the note body, e.g. a collection row's properties. */
  header?: JSX.Element;
  /** Called after the panel's title editor saves a new title. */
  onTitleChange?: (docId: string, title: string) => void;
}> = (props) => {
  const [doc, { mutate }] = createResource(
    () => props.docId,
    (id) => fetchDocDetail(id),
  );
  useLiveNoteResource({
    docId: () => props.docId,
    current: () => doc.latest,
    load: (id) => fetchDocLatest(id) as Promise<DocDetail>,
    mutate: (next) => mutate(next),
  });
  const [title, setTitle] = createSignal("");
  const { update: runUpdateDoc } = useNoteMutations();
  let currentDocId = untrack(() => props.docId);
  let docGeneration = 0;

  createEffect(() => {
    const nextDocId = props.docId;
    if (nextDocId !== currentDocId) {
      currentDocId = nextDocId;
      docGeneration += 1;
    }
  });

  createEffect(() => {
    const current = doc();
    if (!current) return;
    setTitle(current.title);
  });

  const handleTitleCommit = async (nextTitle: string) => {
    const editDocId = props.docId;
    const editGeneration = docGeneration;
    if (!editDocId) return;
    const previous = title();
    const normalized = nextTitle.trim();
    if (!normalized || normalized === previous) return;
    setTitle(normalized);
    try {
      await runUpdateDoc({ id: editDocId, title: normalized });
      props.onTitleChange?.(editDocId, normalized);
    } catch (error) {
      if (props.docId === editDocId && docGeneration === editGeneration) {
        setTitle(previous);
      }
      throw error;
    }
  };

  return (
    <SidePanel
      open={props.open}
      onClose={props.onClose}
      ariaLabel="Document details"
      modal={props.modal}
      width={props.width}
    >
      <Box
        position="sticky"
        top="0"
        zIndex="10"
        px="3"
        pt="3"
        pb="2"
        borderBottomWidth="1px"
        borderColor="border"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.98), rgba(255,255,255,0.9))",
        }}
      >
        <Flex align="flex-start" justify="space-between" gap="3">
          <Box flex="1" minW="0">
            <Show when={props.docId} keyed>
              <InPlaceEditableText
                value={title()}
                placeholder="Untitled note"
                onCommit={handleTitleCommit}
                fontSize="2xl"
                lineHeight="1.05"
                fontWeight="semibold"
                fillWidth
                wrapPreview
              />
            </Show>
          </Box>
          <CloseButton
            size="xs"
            aria-label="Close panel"
            title="Close panel"
            onClick={props.onClose}
          />
        </Flex>
      </Box>

      <Box px="3" py="3">
        {props.header}
        <Show when={props.docId} keyed>
          {(id) => <NoteEventSection docId={id} />}
        </Show>
        <Suspense
          fallback={
            <Text fontSize="sm" color="fg.muted">
              Loading…
            </Text>
          }
        >
          <Show when={doc()} keyed>
            {(d) => (
              <DocumentViewer
                doc={{ ...d, title: title() || d.title }}
                panelMode
                fullPageHref={props.docId ? `/docs/${props.docId}` : undefined}
                onDeleted={props.onDeleted}
                onEditorApiChange={props.onEditorApiChange}
              />
            )}
          </Show>
        </Suspense>
      </Box>
    </SidePanel>
  );
};
