import { useAction, useNavigate } from "@solidjs/router";
import type { JSONContent } from "@tiptap/core";
import {
  For,
  Show,
  createEffect,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Text } from "~/components/ui/text";
import { useToasts } from "~/components/Toast";
import { useAudioRecorder } from "~/features/audio-recorder/useAudioRecorder";
import {
  deleteDocAudio,
  moveDocAudio,
  renameDocAudio,
  transcribeDocAudio,
} from "~/services/doc-audio/doc-audio.actions";
import { fetchDocAudios } from "~/services/doc-audio/doc-audio.queries";
import {
  type DocAudioSummary,
  type TranscriptAnalysis,
  formatStamp,
  segmentsBySection,
  stampSeconds,
} from "~/services/doc-audio/doc-audio.shared";
import { Button } from "~/components/ui/button";
import { DocAudioRow, defaultRecordingLabel } from "./DocAudioRow";
import { DocAudioUploadRow } from "./DocAudioUploadRow";
import type { useDocAudioDrop } from "./useDocAudioDrop";
import { LiveRecordingRow } from "./LiveRecordingRow";
import type { TranscriptMode } from "./TranscriptSections";
import { keepOnFailedRead } from "~/utils/kept-async";

const text = (value: string) => (value ? [{ type: "text", text: value }] : []);

/**
 * Editor blocks for a transcript: one heading and paragraph per section,
 * holding the section summary or the raw words spoken in it.
 */
const transcriptBlocks = (
  analysis: TranscriptAnalysis,
  audio: DocAudioSummary,
  mode: TranscriptMode,
): JSONContent[] => {
  const raw = segmentsBySection(analysis, audio.transcriptSegments ?? []);
  return analysis.sections.flatMap((s, i) => [
    {
      type: "heading",
      attrs: { level: 3 },
      content: text(`${formatStamp(stampSeconds(s.start))} · ${s.title}`),
    },
    {
      type: "paragraph",
      content: text(
        mode === "raw"
          ? raw[i]!.map((seg) => seg.text).join(" ")
          : s.cleanedText.trim(),
      ),
    },
  ]);
};

/** Every finished transcript, oldest first, each under its recording's name. */
const allTranscriptBlocks = (audios: DocAudioSummary[]): JSONContent[] =>
  audios.flatMap((a) =>
    a.transcriptAnalysis
      ? [
          {
            type: "heading",
            attrs: { level: 2 },
            content: text(a.label ?? defaultRecordingLabel(a)),
          },
          ...transcriptBlocks(a.transcriptAnalysis, a, "summary"),
        ]
      : [],
  );

// The editor's task plugin creates the Inbox task for a new taskRef block.
const taskBlock = (value: string): JSONContent => ({
  type: "taskRef",
  content: text(value),
});

const recordingName = (audio: DocAudioSummary | undefined) =>
  audio ? (audio.label ?? defaultRecordingLabel(audio)) : "";

// Transcription runs on the server after Stop; poll until it settles.
const TRANSCRIPT_POLL_MS = 4000;

/**
 * Recordings attached to a note, plus the live recorder when it is recording
 * into this note. Renders nothing for a note without recordings.
 */
export const DocAudioStrip = (props: {
  docId: string;
  /** Appends blocks to the open note's editor. */
  onInsertBlocks?: (blocks: JSONContent[]) => void;
  /** Dropped audio files still uploading (or failed). */
  drop?: ReturnType<typeof useDocAudioDrop>;
}) => {
  const recorder = useAudioRecorder();
  const rename = useAction(renameDocAudio);
  const transcribe = useAction(transcribeDocAudio);
  const move = useAction(moveDocAudio);
  const remove = useAction(deleteDocAudio);
  const navigate = useNavigate();
  const { show: showToast } = useToasts();
  const [audios, { mutate, refetch }] = createResource<
    DocAudioSummary[] | undefined,
    { docId: string; version: number }
  >(
    () => ({ docId: props.docId, version: recorder.listVersion() }),
    ({ docId }, info) =>
      keepOnFailedRead(
        info.value?.[0]?.docId === docId ? info.value : undefined,
        () => fetchDocAudios(docId),
      ),
  );
  const live = () => recorder.isRecordingDoc(props.docId);
  // The active recording shows as the live row, not as a half-written file.
  const stored = () =>
    (audios.latest ?? []).filter(
      (a) => !(live() && a.id === recorder.recordingId()),
    );

  createEffect(() => {
    if (!stored().some((a) => a.transcriptStatus === "pending")) return;
    const timer = setInterval(() => void refetch(), TRANSCRIPT_POLL_MS);
    onCleanup(() => clearInterval(timer));
  });

  const [transcribeError, setTranscribeError] = createSignal<string>();

  const handleTranscribe = async (id: string) => {
    setTranscribeError(undefined);
    try {
      const updated = await transcribe(id);
      mutate((prev) => prev?.map((a) => (a.id === id ? updated : a)));
    } catch (err) {
      console.warn("[doc-audio] transcribe failed", err);
      setTranscribeError(err instanceof Error ? err.message : String(err));
    }
  };

  const error = () => recorder.errorFor(props.docId) ?? transcribeError();

  const insert = (blocks: JSONContent[]) => props.onInsertBlocks?.(blocks);

  const handleRename = async (id: string, label: string) => {
    const updated = await rename({ id, label });
    mutate((prev) => prev?.map((a) => (a.id === id ? updated : a)));
  };

  const handleMove = async (id: string, toDocId: string | null) => {
    const result = await move({ id, toDocId: toDocId ?? undefined });
    mutate((prev) => prev?.filter((a) => a.id !== id));
    showToast({
      type: "success",
      message: toDocId ? "Recording moved" : "Recording moved to a new note",
      actionLabel: "Open note",
      onClick: () => navigate(`/docs/${result.docId}`),
    });
  };

  // Held here, not in the row: the transcript poll replaces every row object,
  // so For remounts the rows and would close a dialog inside one.
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  // Stays set after closing, so the name holds through the fade-out.
  const [deleteTarget, setDeleteTarget] = createSignal<DocAudioSummary>();
  const [deletingId, setDeletingId] = createSignal<string>();

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await remove(id);
      mutate((prev) => prev?.filter((a) => a.id !== id));
      showToast({ type: "success", message: "Recording deleted" });
    } catch (err) {
      console.warn("[doc-audio] delete failed", err);
      showToast({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDeletingId(undefined);
    }
  };

  createEffect(() =>
    props.drop?.listen((audio) => {
      // An upload can finish after the view moved to another note.
      if (audio.docId !== props.docId) return;
      mutate((prev) =>
        [...(prev ?? []), audio].sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        ),
      );
    }),
  );
  const uploads = () => props.drop?.uploads() ?? [];
  const transcribed = () => stored().filter((a) => a.transcriptAnalysis);

  return (
    <Show
      when={live() || stored().length > 0 || uploads().length > 0 || error()}
    >
      <Stack
        gap="2"
        mb="4"
        // The strip sits inside the note's prose styles; its rows set
        // their own rhythm.
        css={{ "& p": { m: "0" } }}
        data-testid="doc-audio-strip"
      >
        <HStack justifyContent="space-between" gap="2">
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="wide"
          >
            Recordings
            <Show when={stored().length > 0}> · {stored().length}</Show>
          </Text>
          <Show when={error()}>
            {(message) => (
              <Text fontSize="xs" color="red.11" role="alert" truncate>
                {message()}
              </Text>
            )}
          </Show>
          <Show when={props.onInsertBlocks && transcribed().length > 1}>
            <Button
              size="xs"
              variant="plain"
              flexShrink="0"
              onClick={() => insert(allTranscriptBlocks(transcribed()))}
            >
              Insert all transcripts
            </Button>
          </Show>
        </HStack>
        <Show when={live()}>
          <LiveRecordingRow />
        </Show>
        <For each={stored()}>
          {(audio) => (
            <DocAudioRow
              audio={audio}
              onRename={(label) => handleRename(audio.id, label)}
              onTranscribe={() => void handleTranscribe(audio.id)}
              onMove={(toDocId) => handleMove(audio.id, toDocId)}
              onDelete={() => {
                setDeleteTarget(audio);
                setConfirmOpen(true);
              }}
              deleting={deletingId() === audio.id}
              onInsert={
                props.onInsertBlocks && audio.transcriptAnalysis
                  ? (mode) =>
                      insert(
                        transcriptBlocks(audio.transcriptAnalysis!, audio, mode),
                      )
                  : undefined
              }
              onAddTask={
                props.onInsertBlocks
                  ? (value) => insert([taskBlock(value)])
                  : undefined
              }
            />
          )}
        </For>
        <For each={uploads()}>
          {(upload) => (
            <DocAudioUploadRow
              upload={upload}
              onRetry={() => props.drop?.retry(upload.key)}
              onDismiss={() => props.drop?.dismiss(upload.key)}
            />
          )}
        </For>
        <ConfirmDialog
          open={confirmOpen()}
          onOpenChange={setConfirmOpen}
          title="Delete recording?"
          description={`"${recordingName(deleteTarget())}" and its transcript will be deleted. This cannot be undone. Text already inserted into the note stays.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => void handleDelete(deleteTarget()!.id)}
        />
      </Stack>
    </Show>
  );
};
