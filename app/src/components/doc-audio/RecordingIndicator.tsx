import { A, useLocation } from "@solidjs/router";
import { Show } from "solid-js";
import { SquareIcon } from "lucide-solid";
import { Box, HStack } from "styled-system/jsx";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import {
  formatDuration,
  useAudioRecorder,
} from "~/features/audio-recorder/useAudioRecorder";
import { LevelBars } from "./LevelBars";
import { RecordingDot } from "./RecordingDot";

/**
 * Floating pill shown while a recording runs and its note is not on screen,
 * so it can be found and stopped from anywhere in the app.
 */
export const RecordingIndicator = () => {
  const recorder = useAudioRecorder();
  const location = useLocation();
  const visible = () => {
    const id = recorder.docId();
    return (
      id !== null &&
      recorder.status() !== "idle" &&
      location.pathname !== `/docs/${id}`
    );
  };

  return (
    <Show when={visible()}>
      <Box
        position="fixed"
        bottom="calc(env(safe-area-inset-bottom) + 16px)"
        left="50%"
        transform="translateX(-50%)"
        zIndex="overlay"
        data-testid="recording-indicator"
      >
        <HStack
          gap="2"
          pl="3"
          pr="1"
          py="1"
          bg="bg.default"
          borderWidth="1px"
          borderColor="red.6"
          borderRadius="full"
          boxShadow="lg"
        >
          <A
            href={`/docs/${recorder.docId()}`}
            style={{ display: "contents", color: "inherit" }}
          >
            <RecordingDot />
            <Text
              as="span"
              fontSize="sm"
              fontWeight="semibold"
              fontVariantNumeric="tabular-nums"
            >
              {formatDuration(recorder.elapsedMs())}
            </Text>
            <LevelBars levels={recorder.levels().slice(-12)} height="4" />
          </A>
          <IconButton
            size="xs"
            variant="plain"
            colorPalette="red"
            borderRadius="full"
            aria-label="Stop recording"
            loading={recorder.status() === "saving"}
            disabled={recorder.status() !== "recording"}
            onClick={() => void recorder.stop()}
          >
            <SquareIcon size={12} fill="currentColor" />
          </IconButton>
        </HStack>
      </Box>
    </Show>
  );
};
