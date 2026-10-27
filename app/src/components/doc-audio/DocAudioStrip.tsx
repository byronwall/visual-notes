import { useAction } from "@solidjs/router";
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
import { Text } from "~/components/ui/text";
import { useAudioRecorder } from "~/features/audio-recorder/useAudioRecorder";
import {
  renameDocAudio,
  transcribeDocAudio,
} from "~/services/doc-audio/doc-audio.actions";
import { fetchDocAudios } from "~/services/doc-audio/doc-audio.queries";
import {
  type DocAudioSummary,
  type TranscriptAnalysis,
  formatStamp,
  stampSeconds,
} from "~/services/doc-audio/doc-audio.shared";
import { Button } from "~/components/ui/button";
import { DocAudioRow, defaultRecordingLabel } from "./DocAudioRow";
import { DocAudioUploadRow } from "./DocAudioUploadRow";
import type { useDocAudioDrop } from "./useDocAudioDrop";
import { LiveRecordingRow } from "./LiveRecordingRow";

const text = (value: string) => (value ? [{ type: "text", text: value }] : []);

/** Editor blocks for a transcript: one heading and paragraph per section. */
const transcriptBlocks = (analysis: TranscriptAnalysis): JSONContent[] =>
  analysis.sections.flatMap((s) => [
    {
      type: "heading",
      attrs: { level: 3 },
      content: text(`${formatStamp(stampSeconds(s.start))} · ${s.title}`),
    },
    { type: "paragraph", content: text(s.cleanedText.trim()) },
  ]);

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
          ...transcriptBlocks(a.transcriptAnalysis),
        ]
      : [],
  );

// The editor's task plugin creates the Inbox task for a new taskRef block.
const taskBlock = (value: string): JSONContent => ({
  type: "taskRef",
  content: text(value),
});

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
  const [audios, { mutate, refetch }] = createResource(
    () => ({ docId: props.docId, version: recorder.listVersion() }),
    ({ docId }) => fetchDocAudios(docId),
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

  createEffect(() =>
    props.drop?.listen((audio) =>
      mutate((prev) =>
        [...(prev ?? []), audio].sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        ),
      ),
    ),
  );
  const uploads = () => props.drop?.uploads() ?? [];
  const transcribed = () => stored().filter((a) => a.transcriptAnalysis);

  return (
    <Show
      when={live() || stored().length > 0 || uploads().length > 0 || error()}
    >
      <Stack gap="2" mb="4" data-testid="doc-audio-strip">
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
              onInsert={
                props.onInsertBlocks && audio.transcriptAnalysis
                  ? () => insert(transcriptBlocks(audio.transcriptAnalysis!))
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
      </Stack>
    </Show>
  );
};
