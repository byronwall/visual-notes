import { revalidate, useAction } from "@solidjs/router";
import { createMemo, createResource, createSignal, For, Show, Suspense, type VoidComponent } from "solid-js";
import { PlusIcon } from "lucide-solid";
import { Box, HStack, Stack } from "styled-system/jsx";
import { openImagePreview } from "~/components/editor/ui/imagePreviewService";
import { InPlaceEditableText } from "~/components/InPlaceEditableText";
import { SidePanel } from "~/components/SidePanel";
import { ArchiveFavicon } from "./ArchiveFavicon";
import { ArchiveGroupField } from "./ArchiveGroupField";
import { CloseButton } from "~/components/ui/close-button";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Input } from "~/components/ui/input";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import {
  addArchivedPageNoteImage,
  createArchivedPageNote,
  deleteArchivedPage,
  deleteArchivedPageNote,
  deleteArchivedPageNoteImage,
  updateArchivedPage,
  updateArchivedPageNote,
  updateArchivedPageNoteImage,
} from "~/services/archive/archive.actions";
import { fetchArchivedPageDetail } from "~/services/archive/archive.service";
import { formatRelativeTime } from "~/features/docs-index/utils/time";

function truncateUrl(url: string, maxLength = 72) {
  if (url.length <= maxLength) return url;
  return `${url.slice(0, maxLength - 1)}…`;
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ArchiveNoteRow = (props: {
  note: {
    id: string;
    noteText: string;
    imageUrls: string[];
    createdAt: string;
  };
  onNoteCommit: (noteId: string, noteText: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onAddImage: (noteId: string, imageUrl: string) => Promise<void>;
  onUpdateImage: (noteId: string, index: number, imageUrl: string) => Promise<void>;
  onDeleteImage: (noteId: string, index: number) => Promise<void>;
}) => {
  const [imageDraft, setImageDraft] = createSignal("");

  return (
    <Stack gap="2" p="3" borderRadius="l3" bg="bg.subtle">
      <HStack justify="space-between" gap="2" alignItems="flex-start">
        <Text fontSize="xs" color="fg.muted">
          {formatRelativeTime(props.note.createdAt)}
        </Text>
        <Button
          type="button"
          size="xs"
          variant="plain"
          colorPalette="red"
          onClick={() => void props.onDeleteNote(props.note.id)}
        >
          Delete
        </Button>
      </HStack>

      <InPlaceEditableText
        value={props.note.noteText}
        placeholder="Add note text"
        onCommit={(value) => props.onNoteCommit(props.note.id, value)}
        activationMode="click"
        fillWidth
        wrapPreview
        allowEmpty
        minInputWidth="16rem"
      />

      <Show when={props.note.imageUrls.length > 0}>
        <Box display="flex" flexWrap="wrap" gap="2">
          <For each={props.note.imageUrls}>
            {(imageUrl, index) => (
              <Stack gap="1">
                <Button
                  type="button"
                  variant="plain"
                  p="0"
                  h="auto"
                  w="auto"
                  onClick={() =>
                    openImagePreview({
                      src: imageUrl,
                      alt: props.note.noteText || "Explorer note image",
                      title: "Explorer image",
                    })
                  }
                >
                  <Box
                    w="110px"
                    h="88px"
                    borderRadius="l2"
                    overflow="hidden"
                    borderWidth="1px"
                    borderColor="border"
                    bg="bg.default"
                  >
                    <img
                      src={imageUrl}
                      alt="Explorer note"
                      style={{
                        width: "100%",
                        height: "100%",
                        "object-fit": "cover",
                        display: "block",
                      }}
                    />
                  </Box>
                </Button>
                <HStack gap="1">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      const next = window.prompt("Update image URL", imageUrl)?.trim();
                      if (!next || next === imageUrl) return;
                      void props.onUpdateImage(props.note.id, index(), next);
                    }}
                  >
                    Edit URL
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="plain"
                    colorPalette="red"
                    onClick={() => void props.onDeleteImage(props.note.id, index())}
                  >
                    Remove
                  </Button>
                </HStack>
              </Stack>
            )}
          </For>
        </Box>
      </Show>

      <HStack gap="2" alignItems="center">
        <Input
          value={imageDraft()}
          placeholder="https://example.com/image.png"
          onInput={(event) => setImageDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            const next = imageDraft().trim();
            if (!next) return;
            void props.onAddImage(props.note.id, next).then(() => setImageDraft(""));
          }}
        />
        <IconButton
          type="button"
          size="sm"
          variant="outline"
          aria-label="Add image URL"
          onClick={() => {
            const next = imageDraft().trim();
            if (!next) return;
            void props.onAddImage(props.note.id, next).then(() => setImageDraft(""));
          }}
        >
          <PlusIcon size={16} />
        </IconButton>
      </HStack>
    </Stack>
  );
};

export const ArchiveDetailDrawer: VoidComponent<{
  open: boolean;
  pageId?: string;
  groupOptions: string[];
  onClose: () => void;
  onChanged?: (pageId?: string) => void;
  onDeleted?: (pageId: string) => void;
}> = (props) => {
  const [detail, { refetch }] = createResource(
    () => props.pageId,
    (id) => fetchArchivedPageDetail(id!),
  );
  const runUpdateArchivedPage = useAction(updateArchivedPage);
  const runDeleteArchivedPage = useAction(deleteArchivedPage);
  const runCreateArchivedPageNote = useAction(createArchivedPageNote);
  const runUpdateArchivedPageNote = useAction(updateArchivedPageNote);
  const runDeleteArchivedPageNote = useAction(deleteArchivedPageNote);
  const runAddArchivedPageNoteImage = useAction(addArchivedPageNoteImage);
  const runUpdateArchivedPageNoteImage = useAction(updateArchivedPageNoteImage);
  const runDeleteArchivedPageNoteImage = useAction(deleteArchivedPageNoteImage);

  const [newNoteText, setNewNoteText] = createSignal("");
  const [newNoteImageUrl, setNewNoteImageUrl] = createSignal("");

  const item = createMemo(() => detail.latest ?? detail());

  const refresh = async () => {
    await refetch();
    props.onChanged?.(props.pageId);
    if (props.pageId) {
      await revalidate(fetchArchivedPageDetail.keyFor(props.pageId));
    }
  };

  const saveTitle = async (id: string, title: string) => {
    await runUpdateArchivedPage({ id, title });
    await refresh();
  };

  const saveGroup = async (id: string, groupName: string) => {
    await runUpdateArchivedPage({ id, groupName });
    await refresh();
  };

  const saveNoteText = async (noteId: string, noteText: string) => {
    await runUpdateArchivedPageNote({ id: noteId, noteText });
    await refresh();
  };

  const removeNote = async (noteId: string) => {
    await runDeleteArchivedPageNote({ id: noteId });
    await refresh();
  };

  const addNoteImage = async (noteId: string, imageUrl: string) => {
    await runAddArchivedPageNoteImage({ noteId, imageUrl });
    await refresh();
  };

  const updateNoteImage = async (noteId: string, index: number, imageUrl: string) => {
    await runUpdateArchivedPageNoteImage({ noteId, index, imageUrl });
    await refresh();
  };

  const removeNoteImage = async (noteId: string, index: number) => {
    await runDeleteArchivedPageNoteImage({ noteId, index });
    await refresh();
  };

  const createNote = async () => {
    if (!props.pageId) return;
    await runCreateArchivedPageNote({
      pageId: props.pageId,
      noteText: newNoteText(),
      imageUrl: newNoteImageUrl() || undefined,
    });
    setNewNoteText("");
    setNewNoteImageUrl("");
    await refresh();
  };

  const deleteEntry = async () => {
    if (!props.pageId) return;
    if (!confirm("Delete this explorer entry and everything captured under it?")) return;
    await runDeleteArchivedPage({ id: props.pageId });
    props.onDeleted?.(props.pageId);
  };

  return (
    <SidePanel
      open={props.open}
      onClose={props.onClose}
      ariaLabel="Explorer item"
      width="min(96vw, 760px)"
    >
      <Box
        position="sticky"
        top="0"
        zIndex="10"
        px="4"
        py="3"
        borderBottomWidth="1px"
        borderColor="border"
        bg="bg.default"
      >
        <HStack alignItems="flex-start" justify="space-between" gap="3">
          <Stack gap="1.5" flex="1" minW="0">
            <Show when={item()}>
              {(current) => (
                <>
                  <HStack gap="2" alignItems="center" minW="0">
                    <ArchiveFavicon src={current().faviconUrl} title={current().title} size="20px" />
                    <Box minW="0" flex="1">
                      <InPlaceEditableText
                        value={current().title}
                        onCommit={(value) => saveTitle(current().id, value)}
                        fillWidth
                        wrapPreview
                        minInputWidth="20rem"
                      />
                    </Box>
                  </HStack>
                  <HStack gap="2" alignItems="center" flexWrap="wrap">
                    <ArchiveGroupField
                      value={current().groupName || ""}
                      options={props.groupOptions}
                      placeholder="Assign group"
                      onCommit={(groupName) => saveGroup(current().id, groupName)}
                    />
                    <Show when={current().siteHostname}>
                      {(host) => (
                        <Text
                          fontSize="xs"
                          color="fg.muted"
                          fontFamily="mono"
                          px="2"
                          py="1"
                          borderRadius="full"
                          bg="bg.subtle"
                        >
                          {host()}
                        </Text>
                      )}
                    </Show>
                    <Show when={current().lastCapturedAt}>
                      {(captured) => (
                        <Text fontSize="xs" color="fg.muted">
                          Updated {formatRelativeTime(captured())}
                        </Text>
                      )}
                    </Show>
                  </HStack>
                  <Show when={current().originalUrl}>
                    {(url) => (
                      <Link
                        href={url()}
                        target="_blank"
                        rel="noreferrer"
                        fontSize="sm"
                        color="fg.muted"
                        textDecoration="underline"
                        lineClamp="1"
                        title={url()}
                      >
                        {truncateUrl(url())}
                      </Link>
                    )}
                  </Show>
                </>
              )}
            </Show>
          </Stack>
          <HStack gap="2" alignItems="center">
            <Button
              type="button"
              size="xs"
              variant="plain"
              colorPalette="red"
              onClick={() => void deleteEntry()}
            >
              Delete
            </Button>
            <CloseButton aria-label="Close explorer drawer" onClick={props.onClose} />
          </HStack>
        </HStack>
      </Box>

      <Box px="4" py="4">
        <Suspense fallback={<Text color="fg.muted">Loading…</Text>}>
          <Show when={item()} fallback={<Text color="fg.muted">No item selected.</Text>}>
            {(current) => (
              <Stack gap="5">
                <Stack gap="3">
                  <Stack gap="2">
                    <HStack justify="space-between" gap="2" alignItems="center">
                      <Text fontSize="sm" color="fg.muted">
                        Notes
                      </Text>
                      <Text fontSize="xs" color="fg.muted">
                        {current().notes.length} total
                      </Text>
                    </HStack>

                    <Stack gap="2" p="3" borderRadius="l3" bg="bg.subtle">
                      <Textarea
                        value={newNoteText()}
                        placeholder="Add a note to this entry"
                        rows={2}
                        onInput={(event) => setNewNoteText(event.currentTarget.value)}
                      />
                      <HStack gap="2">
                        <Input
                          value={newNoteImageUrl()}
                          placeholder="Optional image URL"
                          onInput={(event) => setNewNoteImageUrl(event.currentTarget.value)}
                        />
                        <Button type="button" size="sm" onClick={() => void createNote()}>
                          Add note
                        </Button>
                      </HStack>
                    </Stack>

                    <Show
                      when={current().notes.length > 0}
                      fallback={<Text fontSize="sm" color="fg.muted">No notes yet.</Text>}
                    >
                      <Stack gap="2">
                        <For each={current().notes}>
                          {(note) => (
                            <ArchiveNoteRow
                              note={note}
                              onNoteCommit={saveNoteText}
                              onDeleteNote={removeNote}
                              onAddImage={addNoteImage}
                              onUpdateImage={updateNoteImage}
                              onDeleteImage={removeNoteImage}
                            />
                          )}
                        </For>
                      </Stack>
                    </Show>
                  </Stack>

                  <Box
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="l3"
                    overflow="hidden"
                    bg="bg.subtle"
                  >
                    <HStack alignItems="stretch" gap="0" flexWrap={{ base: "wrap", md: "nowrap" }}>
                      <Show when={current().socialPreviewImageUrl || current().preferredImageUrls[0]}>
                        {(src) => (
                          <Box w={{ base: "100%", md: "260px" }} h={{ base: "180px", md: "200px" }}>
                            <img
                              src={src()}
                              alt={`${current().title} preview`}
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
                      <Stack gap="2" p="3" flex="1" minW="0">
                        <HStack gap="2" alignItems="center">
                          <ArchiveFavicon
                            src={current().faviconUrl}
                            title={current().title}
                            size="20px"
                          />
                          <Text fontSize="sm" fontWeight="semibold" lineClamp="2">
                            {current().title}
                          </Text>
                        </HStack>
                        <Show when={current().description}>
                          {(description) => (
                            <Text fontSize="sm" color="fg.muted">
                              {description()}
                            </Text>
                          )}
                        </Show>
                        <HStack gap="2" flexWrap="wrap">
                          <Show when={current().latestSnapshotId}>
                            {(snapshotId) => (
                              <>
                                <Link href={`/admin/archive/snapshots/${snapshotId()}`} fontSize="xs">
                                  Review latest HTML
                                </Link>
                                <Link
                                  href={`/api/archive/snapshots/${snapshotId()}/html?download=1`}
                                  fontSize="xs"
                                >
                                  Download HTML
                                </Link>
                              </>
                            )}
                          </Show>
                          <Text fontSize="xs" color="fg.muted">
                            {formatBytes(current().latestSnapshotHtmlSizeBytes)}
                          </Text>
                        </HStack>
                      </Stack>
                    </HStack>
                  </Box>

                  <Stack gap="2">
                    <Text fontSize="sm" color="fg.muted">
                      Snapshot history
                    </Text>
                    <Stack gap="3" pl="3" borderLeftWidth="2px" borderColor="border">
                      <For each={current().snapshots}>
                        {(snapshot) => (
                          <Box position="relative" pl="3">
                            <Box
                              position="absolute"
                              left="-9px"
                              top="6px"
                              w="10px"
                              h="10px"
                              borderRadius="full"
                              bg="bg.default"
                              borderWidth="2px"
                              borderColor="border"
                            />
                            <Stack gap="1.5" p="3" borderRadius="l3" bg="bg.subtle">
                              <HStack justify="space-between" gap="2" alignItems="flex-start">
                                <Stack gap="0.5">
                                  <Text fontSize="sm" fontWeight="medium">
                                    {snapshot.title || current().title}
                                  </Text>
                                  <Text fontSize="xs" color="fg.muted">
                                    {snapshot.captureMode} · {formatRelativeTime(snapshot.capturedAt)}
                                  </Text>
                                </Stack>
                                <Text fontSize="xs" color="fg.muted">
                                  {formatBytes(snapshot.htmlSizeBytes)}
                                </Text>
                              </HStack>
                              <Show when={snapshot.groupName}>
                                {(group) => (
                                  <Text fontSize="xs" color="fg.muted">
                                    Group: {group()}
                                  </Text>
                                )}
                              </Show>
                              <Show when={snapshot.textSnippet}>
                                {(snippet) => (
                                  <Text fontSize="sm" color="fg.muted" lineClamp="3">
                                    {snippet()}
                                  </Text>
                                )}
                              </Show>
                              <HStack gap="3" flexWrap="wrap">
                                <Link href={`/admin/archive/snapshots/${snapshot.id}`} fontSize="xs">
                                  Review
                                </Link>
                                <Show when={snapshot.htmlPath}>
                                  <Link
                                    href={`/api/archive/snapshots/${snapshot.id}/html?download=1`}
                                    fontSize="xs"
                                  >
                                    Download HTML
                                  </Link>
                                </Show>
                              </HStack>
                            </Stack>
                          </Box>
                        )}
                      </For>
                    </Stack>
                  </Stack>
                </Stack>
              </Stack>
            )}
          </Show>
        </Suspense>
      </Box>
    </SidePanel>
  );
};
