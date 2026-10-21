import { Show } from "solid-js";
import { SquareIcon, SunIcon } from "lucide-solid";
import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";
import {
  formatDuration,
  useAudioRecorder,
} from "~/features/audio-recorder/useAudioRecorder";
import { wakeLockSupported } from "~/features/audio-recorder/wake-lock";
import { LevelBars } from "./LevelBars";
import { RecordingDot } from "./RecordingDot";

/** The in-progress recording: meter, timer, upload state, and Stop. */
export const LiveRecordingRow = () => {
  const recorder = useAudioRecorder();
  const saving = () => recorder.status() === "saving";
  // The pulsing dot already says "recording"; text only adds what it can't.
  const statusText = () => {
    if (recorder.status() === "starting") return "Starting…";
    if (saving()) return "Saving…";
    const pending = recorder.pendingChunks();
    return pending > 1 ? `${pending} chunks waiting to upload` : "";
  };

  return (
    <HStack
      gap="3"
      px="3"
      py="2"
      borderWidth="1px"
      borderColor="red.6"
      bg="red.2"
      borderRadius="l2"
      role="status"
      aria-live="polite"
      data-testid="doc-audio-live"
    >
      <RecordingDot />
      <Text
        fontSize="sm"
        fontWeight="semibold"
        fontVariantNumeric="tabular-nums"
        minW="12"
      >
        {formatDuration(recorder.elapsedMs())}
      </Text>
      <LevelBars levels={recorder.levels()} />
      <Text fontSize="xs" color="fg.muted" flex="1" minW="0" truncate>
        <Box as="span" srOnly={!statusText()}>
          {statusText() || "Recording"}
        </Box>
      </Text>
      <Show when={wakeLockSupported()}>
        <Tooltip
          content={recorder.keepAwake() ? "Screen stays on" : "Keep screen on"}
          showArrow
          portalled={false}
          contentProps={{ zIndex: "tooltip" }}
        >
          <IconButton
            size="xs"
            variant={recorder.keepAwake() ? "subtle" : "plain"}
            colorPalette="gray"
            aria-label="Keep screen on while recording"
            aria-pressed={recorder.keepAwake()}
            onClick={() => recorder.setKeepAwake(!recorder.keepAwake())}
          >
            <SunIcon size={14} />
          </IconButton>
        </Tooltip>
      </Show>
      <Button
        size="xs"
        variant="solid"
        colorPalette="red"
        loading={saving()}
        disabled={recorder.status() !== "recording"}
        onClick={() => void recorder.stop()}
      >
        <SquareIcon size={12} fill="currentColor" />
        Stop
      </Button>
    </HStack>
  );
};
