import { Show } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import type { AudioUpload } from "./useDocAudioDrop";

/** A dropped recording on its way up, or the reason it didn't make it. */
export const DocAudioUploadRow = (props: {
  upload: AudioUpload;
  onRetry: () => void;
  onDismiss: () => void;
}) => {
  const percent = () => Math.round((props.upload.progress ?? 0) * 100);
  return (
    <Stack
      gap="1.5"
      px="3"
      py="2"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="border"
      borderRadius="l2"
      data-testid="doc-audio-upload"
    >
      <HStack gap="2" minW="0">
        <Text fontSize="sm" fontWeight="medium" flex="1" truncate>
          {props.upload.file.name}
        </Text>
        <Show
          when={props.upload.error}
          fallback={
            <Text
              fontSize="xs"
              color="fg.muted"
              fontVariantNumeric="tabular-nums"
              role="status"
            >
              Uploading {percent()}%
            </Text>
          }
        >
          <Button size="xs" variant="plain" onClick={props.onRetry}>
            Retry
          </Button>
          <Button size="xs" variant="plain" onClick={props.onDismiss}>
            Remove
          </Button>
        </Show>
      </HStack>
      <Show
        when={props.upload.error}
        fallback={
          <Box h="1" bg="bg.muted" borderRadius="full" overflow="hidden">
            <Box h="full" bg="fg.muted" style={{ width: `${percent()}%` }} />
          </Box>
        }
      >
        {(message) => (
          <Text fontSize="xs" color="red.11" role="alert" truncate>
            {message()}
          </Text>
        )}
      </Show>
    </Stack>
  );
};
