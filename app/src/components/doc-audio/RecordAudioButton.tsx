import { MicIcon } from "lucide-solid";
import { IconButton } from "~/components/ui/icon-button";
import { Tooltip } from "~/components/ui/tooltip";
import { useAudioRecorder } from "~/features/audio-recorder/useAudioRecorder";

/** Header button that starts recording into this note. */
export const RecordAudioButton = (props: { docId: string }) => {
  const recorder = useAudioRecorder();
  const here = () => recorder.isRecordingDoc(props.docId);
  const busyElsewhere = () => recorder.status() !== "idle" && !here();
  const label = () =>
    here()
      ? "Recording…"
      : busyElsewhere()
        ? "Already recording another note"
        : "Record audio";

  return (
    <Tooltip
      content={label()}
      showArrow
      portalled={false}
      contentProps={{ zIndex: "tooltip" }}
    >
      <IconButton
        size="sm"
        variant="plain"
        colorPalette={here() ? "red" : "gray"}
        aria-label={label()}
        disabled={recorder.status() !== "idle"}
        onClick={() => void recorder.start(props.docId)}
        data-testid="doc-audio-record"
      >
        <MicIcon size={16} />
      </IconButton>
    </Tooltip>
  );
};
