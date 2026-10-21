import {
  type JSX,
  Show,
  createMemo,
  createResource,
  type VoidComponent,
} from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import { Skeleton } from "~/components/ui/skeleton";
import { Text } from "~/components/ui/text";
import { SidePanel } from "./SidePanel";
import DocumentViewer from "./DocumentViewer";
import { useLiveNoteResource } from "~/features/live-sync/useLiveNoteResource";
import { fetchDoc, fetchDocLatest } from "~/services/docs.service";
import { DocPanelActions } from "./doc-header/DocPanelActions";
import type { DocumentEditorApi } from "./DocumentEditor";

import type { NoteDoc } from "~/lib/note-content/types";

type DocDetail = {
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

const fetchDocDetail = (id: string) => fetchDoc(id) as Promise<DocDetail>;

const PanelSkeleton: VoidComponent = () => (
  <Stack gap="4" pt="3" aria-busy="true" aria-label="Loading note">
    <Skeleton h="7" w="60%" />
    <Skeleton h="9" w="80%" />
    <Stack gap="2.5">
      <Skeleton h="4" w="full" />
      <Skeleton h="4" w="full" />
      <Skeleton h="4" w="85%" />
    </Stack>
  </Stack>
);

/**
 * A note beside the page (Canvas, a collection row peek). It renders the
 * same header, title, and body as the full note page, plus close and
 * open-full-page controls.
 */
export const DocumentSidePanel: VoidComponent<{
  open: boolean;
  docId?: string;
  onClose: () => void;
  onDeleted: (docId: string) => void;
  onEditorApiChange?: (docId: string, api?: DocumentEditorApi) => void;
  /** Leave the page behind interactive (default: modal). */
  modal?: boolean;
  width?: string;
  /** Rendered under the title in place of the collection header. */
  header?: JSX.Element;
  /** Called after the note's title is saved. */
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

  // The note on screen. Switching notes keeps the previous one (dimmed and
  // inert) until the next one loads, so the panel never blanks or jumps.
  // Closing keeps it too, so the panel slides out with its content. A note
  // left over from a closed panel is never shown when it reopens.
  let wasOpen = false;
  const shown = createMemo<DocDetail | undefined>((prev) => {
    const open = props.open && !!props.docId;
    // Gate on state so this read never suspends the page behind the panel.
    const loaded =
      doc.state === "ready" || doc.state === "refreshing"
        ? doc.latest
        : undefined;
    const reopened = open && !wasOpen;
    wasOpen = open;
    if (!open) return prev;
    if (doc.state === "errored") return undefined;
    if (loaded?.id === props.docId) return loaded;
    return reopened ? undefined : prev;
  });
  const shownId = createMemo(() => shown()?.id);
  const switching = () =>
    props.open && !!shownId() && shownId() !== props.docId;

  let bodyEl: HTMLDivElement | undefined;
  const resetScroll = () => {
    bodyEl?.closest("[data-side-panel-scroll]")?.scrollTo({ top: 0 });
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
        ref={bodyEl}
        px="5"
        pb="10"
        inert={switching() || undefined}
        aria-busy={switching()}
        // Fade only when the next note is slow; a quick load swaps cleanly.
        style={{
          opacity: switching() ? 0.45 : 1,
          transition: switching()
            ? "opacity 160ms cubic-bezier(0.23, 1, 0.32, 1) 120ms"
            : "none",
        }}
      >
        <Show
          when={shownId()}
          keyed
          fallback={
            <Show when={doc.error} fallback={<PanelSkeleton />}>
              <Text pt="4" fontSize="sm" color="fg.muted">
                Couldn't load this note.
              </Text>
            </Show>
          }
        >
          {(id) => {
            resetScroll();
            // `shown` can go empty a beat before this keyed view is disposed.
            let last = shown()!;
            const current = () => (last = shown() ?? last);
            return (
              <Box animation="fade-in 160ms cubic-bezier(0.23, 1, 0.32, 1)">
                <DocumentViewer
                  doc={current()}
                  panelMode
                  headerTrailing={
                    <DocPanelActions
                      fullPageHref={`/docs/${id}`}
                      onClose={props.onClose}
                    />
                  }
                  subheader={props.header}
                  onDeleted={props.onDeleted}
                  onEditorApiChange={props.onEditorApiChange}
                  onTitleChange={props.onTitleChange}
                />
              </Box>
            );
          }}
        </Show>
      </Box>
    </SidePanel>
  );
};
