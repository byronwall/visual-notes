import { revalidate, useAction } from "@solidjs/router";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
  Trash2Icon,
} from "lucide-solid";
import {
  For,
  Show,
  createMemo,
  createResource,
  createSignal,
  type VoidComponent,
} from "solid-js";
import { createStore } from "solid-js/store";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { InPlaceEditableText } from "~/components/InPlaceEditableText";
import { SidePanel } from "~/components/SidePanel";
import { CloseButton } from "~/components/ui/close-button";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import { forgetQuery } from "~/features/live-sync/forget-query";
import { useAppChanges } from "~/features/live-sync/NoteLiveSyncProvider";
import { formatRelativeTime } from "~/features/docs-index/utils/time";
import {
  addArchivedPageNoteImage,
  createArchivedPageNote,
  deleteArchivedPage,
  deleteArchivedPageNote,
  deleteArchivedPageNoteImage,
  updateArchivedPage,
  updateArchivedPageNote,
} from "~/services/archive/archive.actions";
import { fetchArchivedPageDetail } from "~/services/archive/archive.service";
import { ArchiveFavicon } from "./ArchiveFavicon";
import { ArchiveGroupSwitcher } from "./ArchiveGroupSwitcher";
import {
  ArchiveNoteComposer,
  type NoteDraft,
} from "./detail/ArchiveNoteComposer";
import { ArchiveNoteItem } from "./detail/ArchiveNoteItem";
import { ArchiveSnapshotList } from "./detail/ArchiveSnapshotList";
import { displayUrl, formatExactTime } from "./list/archive-list-filters";

const sectionLabelClass = css({
  fontSize: "xs",
  fontWeight: "medium",
  color: "fg.muted",
  textTransform: "uppercase",
  letterSpacing: "wider",
});

export const ArchiveDetailDrawer: VoidComponent<{
  open: boolean;
  pageId?: string;
  groupOptions: string[];
  onClose: () => void;
  onChanged?: (pageId?: string) => void;
  onDeleted?: (pageId: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
}> = (props) => {
  const [detail, { refetch }] = createResource(
    () => props.pageId,
    (id) => fetchArchivedPageDetail(id),
  );
  // Agents add notes to saved pages; show them on the open page.
  useAppChanges(
    "archive",
    (ids) =>
      void forgetQuery(
        (ids ?? [props.pageId ?? ""]).map((id) =>
          fetchArchivedPageDetail.keyFor(id),
        ),
      ).then(refetch),
    (id) => id === props.pageId,
  );
  const runUpdateArchivedPage = useAction(updateArchivedPage);
  const runDeleteArchivedPage = useAction(deleteArchivedPage);
  const runCreateArchivedPageNote = useAction(createArchivedPageNote);
  const runUpdateArchivedPageNote = useAction(updateArchivedPageNote);
  const runDeleteArchivedPageNote = useAction(deleteArchivedPageNote);
  const runAddArchivedPageNoteImage = useAction(addArchivedPageNoteImage);
  const runDeleteArchivedPageNoteImage = useAction(deleteArchivedPageNoteImage);

  const [drafts, setDrafts] = createStore<Record<string, NoteDraft>>({});
  const [isCreatingNote, setIsCreatingNote] = createSignal(false);
  let composerInput: HTMLTextAreaElement | undefined;

  const draftFor = (pageId: string) =>
    drafts[pageId] ?? { text: "", imageUrl: "" };
  const updateDraft = (pageId: string, patch: Partial<NoteDraft>) =>
    setDrafts(pageId, { ...draftFor(pageId), ...patch });

  // Keep the previous page on screen while the next one loads so j/k paging does not flash.
  const item = createMemo(() => detail.latest);
  const isStale = () => Boolean(item() && item()!.id !== props.pageId);

  const refresh = async (pageId: string) => {
    if (props.pageId === pageId) await refetch();
    props.onChanged?.(pageId);
    await revalidate(fetchArchivedPageDetail.keyFor(pageId));
  };

  const createNote = async (pageId: string) => {
    if (isCreatingNote()) return;
    const draft = draftFor(pageId);
    const noteText = draft.text.trim();
    const imageUrl = draft.imageUrl.trim();
    if (!noteText && !imageUrl) return;
    setIsCreatingNote(true);
    updateDraft(pageId, { error: undefined });
    try {
      const created = await runCreateArchivedPageNote({
        pageId,
        noteText,
        imageUrl: imageUrl || undefined,
      });
      if (typeof created?.id !== "string" || created.pageId !== pageId) {
        throw new Error("Could not add note. Try again.");
      }
      const latest = drafts[pageId];
      if (latest?.text === draft.text && latest.imageUrl === draft.imageUrl) {
        updateDraft(pageId, { text: "", imageUrl: "", error: undefined });
        if (composerInput) composerInput.style.height = "auto";
      }
      await refresh(pageId);
    } catch (error) {
      updateDraft(pageId, {
        error: error instanceof Error ? error.message : "Could not add note.",
      });
    } finally {
      setIsCreatingNote(false);
    }
  };

  const deleteEntry = async () => {
    const pageId = item()?.id;
    if (!pageId) return;
    if (!confirm(`Delete “${item()?.title}” with its captures and notes?`))
      return;
    await runDeleteArchivedPage({ id: pageId });
    props.onDeleted?.(pageId);
  };

  const previewImage = () =>
    item()?.socialPreviewImageUrl || item()?.preferredImageUrls[0];

  return (
    <SidePanel
      open={props.open}
      onClose={props.onClose}
      ariaLabel="Captured page"
      width="min(100vw, 640px)"
    >
      <Show
        when={item()}
        fallback={
          <Stack gap="3" p="5">
            <Box h="5" w="70%" borderRadius="l1" bg="bg.subtle" />
            <Box h="3" w="45%" borderRadius="l1" bg="bg.subtle" />
            <Box h="24" borderRadius="l3" bg="bg.subtle" mt="2" />
          </Stack>
        }
      >
        {(current) => (
          <Box
            opacity={isStale() ? 0.55 : 1}
            transitionProperty="opacity"
            transitionDuration="fast"
          >
            <Box
              position="sticky"
              top="0"
              zIndex="10"
              px="5"
              pt="4"
              pb="3"
              bg="bg.default"
              boxShadow="0 1px 0 var(--colors-gray-a3)"
            >
              <HStack alignItems="flex-start" gap="3">
                <Box pt="1">
                  <ArchiveFavicon
                    src={current().faviconUrl}
                    title={current().title}
                    size="20px"
                  />
                </Box>
                <Box
                  minW="0"
                  flex="1"
                  fontSize="lg"
                  fontWeight="semibold"
                  lineHeight="snug"
                >
                  <InPlaceEditableText
                    value={current().title}
                    onCommit={async (title) => {
                      await runUpdateArchivedPage({ id: current().id, title });
                      await refresh(current().id);
                    }}
                    fillWidth
                    wrapPreview
                    fontSize="lg"
                    fontWeight="semibold"
                    minInputWidth="16rem"
                  />
                </Box>
                <HStack gap="0.5" flexShrink="0">
                  <Show when={props.onPrev}>
                    <IconButton
                      type="button"
                      size="xs"
                      variant="plain"
                      aria-label="Previous page (k)"
                      title="Previous (k)"
                      onClick={() => props.onPrev?.()}
                    >
                      <ChevronUpIcon size={16} />
                    </IconButton>
                    <IconButton
                      type="button"
                      size="xs"
                      variant="plain"
                      aria-label="Next page (j)"
                      title="Next (j)"
                      onClick={() => props.onNext?.()}
                    >
                      <ChevronDownIcon size={16} />
                    </IconButton>
                  </Show>
                  <CloseButton
                    size="xs"
                    aria-label="Close"
                    onClick={props.onClose}
                  />
                </HStack>
              </HStack>

              <Box
                pl="8"
                mt="1.5"
                display="flex"
                flexDirection="column"
                gap="1.5"
              >
                <a
                  href={current().originalUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={current().originalUrl}
                  class={css({
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "1.5",
                    maxW: "full",
                    fontFamily: "mono",
                    fontSize: "xs",
                    color: "colorPalette.default",
                    colorPalette: "blue",
                    _hover: { textDecoration: "underline" },
                  })}
                >
                  <span
                    class={css({
                      minW: "0",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    })}
                  >
                    {displayUrl(current().originalUrl)}
                  </span>
                  <ExternalLinkIcon size={12} class={css({ flexShrink: 0 })} />
                </a>
                <HStack gap="2" fontSize="xs" color="fg.muted" flexWrap="wrap">
                  <ArchiveGroupSwitcher
                    value={current().groupName || ""}
                    options={props.groupOptions}
                    placeholder="Add group"
                    onCommit={async (groupName) => {
                      await runUpdateArchivedPage({
                        id: current().id,
                        groupName,
                      });
                      await refresh(current().id);
                    }}
                  />
                  <Show when={current().lastCapturedAt}>
                    {(captured) => (
                      <span title={formatExactTime(captured())}>
                        Captured {formatRelativeTime(captured())}
                      </span>
                    )}
                  </Show>
                  <HStack as="span" gap="0" ml="auto">
                    <IconButton
                      type="button"
                      size="xs"
                      variant="plain"
                      colorPalette="red"
                      aria-label="Delete page"
                      title="Delete page"
                      onClick={() => void deleteEntry()}
                    >
                      <Trash2Icon size={14} />
                    </IconButton>
                  </HStack>
                </HStack>
              </Box>
            </Box>

            <Stack gap="5" px="5" py="4">
              <Show when={previewImage() || current().description}>
                <Stack gap="2.5">
                  <Show when={previewImage()}>
                    {(src) => (
                      <Box
                        borderRadius="l3"
                        overflow="hidden"
                        bg="bg.subtle"
                        aspectRatio="1200 / 630"
                        maxH="260px"
                        boxShadow="inset 0 0 0 1px var(--colors-gray-a3)"
                      >
                        <img
                          src={src()}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            "object-fit": "cover",
                            display: "block",
                          }}
                        />
                      </Box>
                    )}
                  </Show>
                  <Show when={current().description}>
                    {(description) => (
                      <Text fontSize="sm" color="fg.muted" lineHeight="relaxed">
                        {description()}
                      </Text>
                    )}
                  </Show>
                </Stack>
              </Show>

              <Stack gap="2">
                <HStack gap="2" alignItems="baseline">
                  <span class={sectionLabelClass}>Notes</span>
                  <Show when={current().notes.length > 0}>
                    <Text fontSize="xs" color="fg.subtle">
                      {current().notes.length}
                    </Text>
                  </Show>
                </HStack>
                <ArchiveNoteComposer
                  draft={draftFor(current().id)}
                  busy={isCreatingNote()}
                  onDraft={(patch) => updateDraft(current().id, patch)}
                  onSubmit={() => void createNote(current().id)}
                  textareaRef={(element) => (composerInput = element)}
                />
                <Stack gap="0" divideY="1px" divideColor="gray.a3">
                  <For each={current().notes}>
                    {(note) => (
                      <ArchiveNoteItem
                        note={note}
                        onNoteCommit={async (noteText) => {
                          await runUpdateArchivedPageNote({
                            id: note.id,
                            noteText,
                          });
                          await refresh(current().id);
                        }}
                        onDelete={async () => {
                          await runDeleteArchivedPageNote({ id: note.id });
                          await refresh(current().id);
                        }}
                        onAddImage={async (imageUrl) => {
                          await runAddArchivedPageNoteImage({
                            noteId: note.id,
                            imageUrl,
                          });
                          await refresh(current().id);
                        }}
                        onDeleteImage={async (index) => {
                          await runDeleteArchivedPageNoteImage({
                            noteId: note.id,
                            index,
                          });
                          await refresh(current().id);
                        }}
                      />
                    )}
                  </For>
                </Stack>
              </Stack>

              <Show when={current().snapshots.length > 0}>
                <Stack gap="1">
                  <HStack gap="2" alignItems="baseline">
                    <span class={sectionLabelClass}>Captures</span>
                    <Text fontSize="xs" color="fg.subtle">
                      {current().snapshots.length}
                    </Text>
                  </HStack>
                  <ArchiveSnapshotList
                    snapshots={current().snapshots}
                    pageTitle={current().title}
                  />
                </Stack>
              </Show>
            </Stack>
          </Box>
        )}
      </Show>
    </SidePanel>
  );
};
