import { useAction } from "@solidjs/router";
import {
  finishDocAudio,
  startDocAudio,
} from "~/services/doc-audio/doc-audio.actions";
import { recorderStore, type RecorderCalls } from "./recorder-store";

/** The app-wide recorder, with its server writes bound for this component. */
export function useAudioRecorder() {
  const calls: RecorderCalls = {
    start: useAction(startDocAudio),
    finish: useAction(finishDocAudio),
  };
  return {
    ...recorderStore,
    start: (target: string | (() => Promise<string>)) =>
      recorderStore.start(target, calls),
    isRecordingDoc: (id: string) =>
      recorderStore.docId() === id && recorderStore.status() !== "idle",
  };
}

export const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};
