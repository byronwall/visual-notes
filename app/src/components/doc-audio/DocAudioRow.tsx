import { Match, Show, Switch, createSignal } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { InPlaceEditableText } from "~/components/InPlaceEditableText";
import { Badge } from "~/components/ui/badge";
import { Text } from "~/components/ui/text";
import { formatDuration } from "~/features/audio-recorder/useAudioRecorder";
import {
  type DocAudioSummary,
  docAudioUrl,
  readableTranscriptError,
} from "~/services/doc-audio/doc-audio.shared";
import { DocAudioTranscript } from "./DocAudioTranscript";
import type { TranscriptMode } from "./TranscriptSections";
import { TranscriptStatusLine } from "./TranscriptStatusLine";

const timeFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const defaultRecordingLabel = (audio: DocAudioSummary) =>
  `Recording · ${timeFormat.format(new Date(audio.createdAt))}`;

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** One stored recording: editable name, details, player, and transcript. */
export const DocAudioRow = (props: {
  audio: DocAudioSummary;
  onRename: (label: string) => Promise<void>;
  onTranscribe: () => void;
  onInsert?: (mode: TranscriptMode) => void;
  onAddTask?: (text: string) => void;
}) => {
  let player: HTMLAudioElement | undefined;
  const [time, setTime] = createSignal<number | null>(null);
  const [playing, setPlaying] = createSignal(false);
  const seek = (seconds: number) => {
    if (!player) return;
    player.currentTime = seconds;
    // play() rejects when a pause or new seek interrupts it; that's fine.
    player.play().catch(() => {});
  };

  return (
    <Stack
      gap="1.5"
      px="3"
      py="2"
      borderWidth="1px"
      borderColor="border"
      borderRadius="l2"
      bg="bg.default"
      data-testid="doc-audio-row"
    >
      <HStack gap="2" alignItems="baseline" minW="0">
        <Box flex="1" minW="0">
          <InPlaceEditableText
            value={props.audio.label ?? ""}
            placeholder={defaultRecordingLabel(props.audio)}
            onCommit={(value) => props.onRename(value)}
            allowEmpty
            fontSize="sm"
            fontWeight="medium"
            fillWidth
            truncatePreview
          />
        </Box>
        <Show when={props.audio.status === "recording"}>
          <Badge size="sm" variant="subtle" colorPalette="amber">
            Interrupted
          </Badge>
        </Show>
        <Text
          fontSize="xs"
          color="fg.muted"
          fontVariantNumeric="tabular-nums"
          flexShrink="0"
        >
          {formatDuration(props.audio.durationMs)} ·{" "}
          {formatSize(props.audio.sizeBytes)}
        </Text>
      </HStack>
      <audio
        ref={player}
        controls
        preload="metadata"
        src={docAudioUrl(props.audio.id)}
        style={{ width: "100%", height: "36px" }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <Switch>
        <Match when={props.audio.transcriptAnalysis}>
          {(analysis) => (
            <DocAudioTranscript
              analysis={analysis()}
              segments={props.audio.transcriptSegments ?? []}
              time={time()}
              playing={playing()}
              onSeek={seek}
              onInsert={props.onInsert}
              onAddTask={props.onAddTask}
            />
          )}
        </Match>
        <Match when={props.audio.transcriptStatus === "pending"}>
          <TranscriptStatusLine busy>Transcribing…</TranscriptStatusLine>
        </Match>
        <Match when={props.audio.transcriptStatus === "failed"}>
          <TranscriptStatusLine
            tone="error"
            action="Retry"
            onAction={props.onTranscribe}
          >
            Transcript failed:{" "}
            {readableTranscriptError(props.audio.transcriptError ?? "unknown error")}
          </TranscriptStatusLine>
        </Match>
        <Match when={props.audio.transcriptStatus === "none"}>
          <TranscriptStatusLine action="Transcribe" onAction={props.onTranscribe}>
            Not transcribed yet
          </TranscriptStatusLine>
        </Match>
      </Switch>
    </Stack>
  );
};
