import { useAction } from "@solidjs/router";
import { For, Show, createResource } from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import { useAudioRecorder } from "~/features/audio-recorder/useAudioRecorder";
import { renameDocAudio } from "~/services/doc-audio/doc-audio.actions";
import { fetchDocAudios } from "~/services/doc-audio/doc-audio.queries";
import { DocAudioRow } from "./DocAudioRow";
import { LiveRecordingRow } from "./LiveRecordingRow";

/**
 * Recordings attached to a note, plus the live recorder when it is recording
 * into this note. Renders nothing for a note without recordings.
 */
export const DocAudioStrip = (props: { docId: string }) => {
  const recorder = useAudioRecorder();
  const rename = useAction(renameDocAudio);
  const [audios, { mutate }] = createResource(
    () => ({ docId: props.docId, version: recorder.listVersion() }),
    ({ docId }) => fetchDocAudios(docId),
  );
  const live = () => recorder.isRecordingDoc(props.docId);
  // The active recording shows as the live row, not as a half-written file.
  const stored = () =>
    (audios.latest ?? []).filter(
      (a) => !(live() && a.id === recorder.recordingId()),
    );

  const handleRename = async (id: string, label: string) => {
    const updated = await rename({ id, label });
    mutate((prev) => prev?.map((a) => (a.id === id ? updated : a)));
  };

  return (
    <Show
      when={live() || stored().length > 0 || recorder.errorFor(props.docId)}
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
          <Show when={recorder.errorFor(props.docId)}>
            {(message) => (
              <Text fontSize="xs" color="red.11" role="alert" truncate>
                {message()}
              </Text>
            )}
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
            />
          )}
        </For>
      </Stack>
    </Show>
  );
};
