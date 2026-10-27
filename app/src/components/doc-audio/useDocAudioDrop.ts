import { createSignal, onCleanup } from "solid-js";
import { useAudioRecorder } from "~/features/audio-recorder/useAudioRecorder";
import {
  type DocAudioSummary,
  isAudioFile,
} from "~/services/doc-audio/doc-audio.shared";
import { uploadDocAudio } from "./uploadDocAudio";

export type AudioUpload = {
  key: number;
  file: File;
  /** 0–1 while sending; null once it failed. */
  progress: number | null;
  error?: string;
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Upload failed";

/** Any audio in a drag, read from item types (names aren't readable yet). */
const dragHasAudio = (dt: DataTransfer | null) =>
  Array.from(dt?.items ?? []).some(
    (item) => item.kind === "file" && item.type.startsWith("audio/"),
  );

/**
 * Turns audio files dropped anywhere on a note into recordings. Drops are
 * caught in the capture phase, ahead of the editor; other files in the same
 * drop go to the editor as attachments.
 */
export function useDocAudioDrop(props: {
  docId: () => string;
  onOtherFiles: (files: File[]) => void;
}) {
  const recorder = useAudioRecorder();
  const [uploads, setUploads] = createSignal<AudioUpload[]>([]);
  const [dragging, setDragging] = createSignal(false);
  let nextKey = 0;
  // The strip swaps a finished upload into its list without a refetch gap.
  let onUploaded: (audio: DocAudioSummary) => void = () =>
    recorder.bumpList();
  // Uploads go one at a time, in drop order.
  let chain: Promise<void> = Promise.resolve();

  const patch = (key: number, next: Partial<AudioUpload>) =>
    setUploads((list) =>
      list.map((u) => (u.key === key ? { ...u, ...next } : u)),
    );
  const remove = (key: number) =>
    setUploads((list) => list.filter((u) => u.key !== key));

  const send = (upload: AudioUpload) => {
    const docId = props.docId();
    chain = chain.then(async () => {
      patch(upload.key, { progress: 0, error: undefined });
      try {
        const audio = await uploadDocAudio(docId, upload.file, (fraction) =>
          patch(upload.key, { progress: fraction }),
        );
        onUploaded(audio);
        remove(upload.key);
      } catch (error) {
        console.warn("[doc-audio] upload failed", upload.file.name, error);
        patch(upload.key, { progress: null, error: errorMessage(error) });
      }
    });
  };

  const addFiles = (files: File[]) => {
    for (const file of files) {
      const upload = { key: ++nextKey, file, progress: 0 };
      setUploads((list) => [...list, upload]);
      send(upload);
    }
  };

  const onDragOver = (event: DragEvent) => {
    if (!dragHasAudio(event.dataTransfer)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    setDragging(true);
  };
  const onDragLeave = (event: DragEvent) => {
    const root = event.currentTarget as HTMLElement;
    if (!root.contains(event.relatedTarget as Node | null)) setDragging(false);
  };
  const onDrop = (event: DragEvent) => {
    setDragging(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    const audio = files.filter(isAudioFile);
    if (!audio.length) return;
    event.preventDefault();
    event.stopPropagation();
    addFiles(audio);
    const rest = files.filter((f) => !audio.includes(f));
    if (rest.length) props.onOtherFiles(rest);
  };

  /** Wires the drop zone; pass the note's root element. */
  const bind = (root: HTMLElement) => {
    const opts = { capture: true };
    root.addEventListener("dragover", onDragOver, opts);
    root.addEventListener("dragleave", onDragLeave, opts);
    root.addEventListener("drop", onDrop, opts);
    onCleanup(() => {
      root.removeEventListener("dragover", onDragOver, opts);
      root.removeEventListener("dragleave", onDragLeave, opts);
      root.removeEventListener("drop", onDrop, opts);
    });
  };

  return {
    uploads,
    dragging,
    bind,
    retry: (key: number) => {
      const upload = uploads().find((u) => u.key === key);
      if (upload) send(upload);
    },
    dismiss: remove,
    listen: (handler: (audio: DocAudioSummary) => void) => {
      onUploaded = handler;
    },
  };
}
