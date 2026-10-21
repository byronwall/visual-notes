import { createSignal } from "solid-js";
import type { DocAudioSummary } from "~/services/doc-audio/doc-audio.shared";
import { createChunkUploader } from "./chunk-uploader";
import { LEVEL_HISTORY, startLevelMeter } from "./level-meter";
import { createScreenWakeLock } from "./wake-lock";

// One recorder for the whole app, so a recording keeps going while you move
// between notes. All state below only ever changes in the browser.

export type RecorderStatus = "idle" | "starting" | "recording" | "saving";

export type RecorderCalls = {
  start: (input: {
    docId: string;
    mimeType: string;
  }) => Promise<DocAudioSummary>;
  finish: (input: { id: string; durationMs: number }) => Promise<unknown>;
};

/** Seconds of audio per uploaded chunk; at most this much is lost on a crash. */
const CHUNK_MS = 5_000;
const WAKE_LOCK_KEY = "vn.audio.wakeLock";

const MIME_PREFERENCE = [
  // mp4 first: iOS only records mp4, and it carries a real duration.
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
];

const [status, setStatus] = createSignal<RecorderStatus>("idle");
const [docId, setDocId] = createSignal<string | null>(null);
const [recordingId, setRecordingId] = createSignal<string | null>(null);
const [elapsedMs, setElapsedMs] = createSignal(0);
const [levels, setLevels] = createSignal<number[]>(
  Array.from({ length: LEVEL_HISTORY }, () => 0),
);
const [pendingChunks, setPendingChunks] = createSignal(0);
const [error, setErrorState] = createSignal<{
  docId: string | null;
  message: string;
} | null>(null);
const [keepAwake, setKeepAwakeSignal] = createSignal(readKeepAwake());
// Bumped whenever a recording starts or finishes so lists refetch.
const [listVersion, setListVersion] = createSignal(0);

let session: {
  recorder: MediaRecorder;
  stream: MediaStream;
  context: AudioContext;
  stopMeter: () => void;
  timer: ReturnType<typeof setInterval>;
  startedAt: number;
  uploader: ReturnType<typeof createChunkUploader>;
  calls: RecorderCalls;
} | null = null;
const wakeLock = typeof window === "undefined" ? null : createScreenWakeLock();

function readKeepAwake() {
  try {
    return globalThis.localStorage?.getItem(WAKE_LOCK_KEY) === "1";
  } catch {
    return false;
  }
}

const onBeforeUnload = (event: BeforeUnloadEvent) => {
  event.preventDefault();
};

function describeStartError(e: unknown) {
  if (e instanceof DOMException && e.name === "NotAllowedError") {
    return "Microphone access was blocked";
  }
  if (e instanceof DOMException && e.name === "NotFoundError") {
    return "No microphone found";
  }
  return e instanceof Error ? e.message : "Could not start recording";
}

function pickMimeType() {
  return (
    MIME_PREFERENCE.find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
  );
}

/**
 * Start recording into a note. `target` may be a function that creates the
 * note, so the microphone is opened first while the tap still counts as a
 * user gesture (iOS needs that for the audio context).
 */
async function start(
  target: string | (() => Promise<string>),
  calls: RecorderCalls,
) {
  if (status() !== "idle") return null;
  setErrorState(null);
  setStatus("starting");
  let targetDocId = typeof target === "string" ? target : null;
  // Created synchronously inside the tap so Safari lets it run.
  const context = new AudioContext();
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    if (typeof target !== "string") targetDocId = await target();
    const resolvedDocId = targetDocId!;
    const row = await calls.start({
      docId: resolvedDocId,
      mimeType: recorder.mimeType || mimeType,
    });
    const startedAt = Date.now();
    const uploader = createChunkUploader(row.id, setPendingChunks);
    recorder.ondataavailable = (event) =>
      uploader.push(event.data, Date.now() - startedAt);
    recorder.onerror = () => void stop("Recorder error");
    // A call or another app taking the mic ends the track; keep what we have.
    for (const track of stream.getAudioTracks()) {
      track.onended = () => void stop("Microphone was interrupted");
    }
    session = {
      recorder,
      stream,
      context,
      startedAt,
      uploader,
      calls,
      stopMeter: startLevelMeter(context, stream, setLevels),
      timer: setInterval(() => setElapsedMs(Date.now() - startedAt), 250),
    };
    recorder.start(CHUNK_MS);
    setDocId(resolvedDocId);
    setRecordingId(row.id);
    setElapsedMs(0);
    setStatus("recording");
    setListVersion((v) => v + 1);
    wakeLock?.set(keepAwake());
    window.addEventListener("beforeunload", onBeforeUnload);
    console.info("[audio-recorder] recording", row.id, recorder.mimeType);
    return resolvedDocId;
  } catch (e) {
    console.error("[audio-recorder] start failed", e);
    stream?.getTracks().forEach((t) => t.stop());
    void context.close();
    setErrorState({
      docId: targetDocId,
      message: describeStartError(e),
    });
    setStatus("idle");
    return null;
  }
}

async function stop(reason?: string) {
  const active = session;
  if (!active || status() !== "recording") return;
  setStatus("saving");
  if (reason) setErrorState({ docId: docId(), message: reason });
  const durationMs = Date.now() - active.startedAt;
  const stopped = new Promise<void>((resolve) => {
    active.recorder.onstop = () => resolve();
  });
  if (active.recorder.state !== "inactive") active.recorder.stop();
  else active.recorder.onstop?.(new Event("stop"));
  await stopped;
  clearInterval(active.timer);
  active.stopMeter();
  active.stream.getTracks().forEach((t) => t.stop());
  void active.context.close();
  wakeLock?.set(false);
  await active.uploader.drained();
  try {
    await active.calls.finish({ id: recordingId()!, durationMs });
  } catch (e) {
    console.error("[audio-recorder] finish failed", e);
    setErrorState({
      docId: docId(),
      message: "Saved the audio, but could not mark it finished",
    });
  }
  window.removeEventListener("beforeunload", onBeforeUnload);
  session = null;
  setStatus("idle");
  setDocId(null);
  setRecordingId(null);
  setLevels(Array.from({ length: LEVEL_HISTORY }, () => 0));
  setListVersion((v) => v + 1);
}

function setKeepAwake(enabled: boolean) {
  setKeepAwakeSignal(enabled);
  try {
    localStorage.setItem(WAKE_LOCK_KEY, enabled ? "1" : "0");
  } catch {
    // Private mode: the toggle still works for this session.
  }
  if (session) wakeLock?.set(enabled);
}

export const recorderStore = {
  status,
  docId,
  recordingId,
  elapsedMs,
  levels,
  pendingChunks,
  /** The last error message, when it belongs to this note. */
  errorFor: (id: string) => {
    const current = error();
    return current && (current.docId === id || current.docId === null)
      ? current.message
      : null;
  },
  keepAwake,
  listVersion,
  bumpList: () => setListVersion((v) => v + 1),
  clearError: () => setErrorState(null),
  start,
  stop,
  setKeepAwake,
};
