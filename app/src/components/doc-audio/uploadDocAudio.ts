import {
  DOC_AUDIO_UPLOAD_MAX_BYTES,
  DOC_AUDIO_UPLOAD_URL,
  type DocAudioSummary,
} from "~/services/doc-audio/doc-audio.shared";

// Dropped recordings can be tens of megabytes, so they post with XHR for
// upload progress (fetch has none), like note file attachments.

/** Duration from the file's own metadata; 0 when the browser can't read it. */
export function readAudioDurationMs(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (ms: number) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(ms) ? Math.round(ms) : 0);
    };
    const timer = setTimeout(() => done(0), 5_000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => done(audio.duration * 1000);
    audio.onerror = () => done(0);
    audio.src = url;
  });
}

/** Stores a dropped audio file as a recording on a note. */
export async function uploadDocAudio(
  docId: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<DocAudioSummary> {
  if (file.size === 0) throw new Error(`${file.name} is empty`);
  if (file.size > DOC_AUDIO_UPLOAD_MAX_BYTES) {
    throw new Error(
      `${file.name} is larger than ${DOC_AUDIO_UPLOAD_MAX_BYTES / 1024 / 1024} MB`,
    );
  }
  const durationMs = await readAudioDurationMs(file);
  const params = new URLSearchParams({
    docId,
    name: file.name,
    lastModified: String(file.lastModified),
    durationMs: String(durationMs),
  });
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${DOC_AUDIO_UPLOAD_URL}?${params}`);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new Error("Could not reach the server"));
    xhr.onload = () => {
      let body: Partial<DocAudioSummary & { error: string }> = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // fall through to the status message
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.id) {
        return resolve(body as DocAudioSummary);
      }
      reject(new Error(body.error || `Upload failed (${xhr.status})`));
    };
    xhr.send(file);
  });
}
