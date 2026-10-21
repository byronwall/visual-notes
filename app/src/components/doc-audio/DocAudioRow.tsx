import { Show } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { InPlaceEditableText } from "~/components/InPlaceEditableText";
import { Badge } from "~/components/ui/badge";
import { Text } from "~/components/ui/text";
import { formatDuration } from "~/features/audio-recorder/useAudioRecorder";
import {
  type DocAudioSummary,
  docAudioUrl,
} from "~/services/doc-audio/doc-audio.shared";

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

/** One stored recording: editable name, details, and a player. */
export const DocAudioRow = (props: {
  audio: DocAudioSummary;
  onRename: (label: string) => Promise<void>;
}) => (
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
    <HStack gap="2" alignItems="center" minW="0">
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
      controls
      preload="metadata"
      src={docAudioUrl(props.audio.id)}
      style={{ width: "100%", height: "36px" }}
    />
  </Stack>
);
