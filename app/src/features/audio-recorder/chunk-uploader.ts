import { docAudioChunkUrl } from "~/services/doc-audio/doc-audio.shared";

type PendingChunk = { seq: number; blob: Blob; elapsedMs: number };

const MAX_BACKOFF_MS = 15_000;

/**
 * Uploads recorder chunks in order, retrying with backoff until each one is
 * stored. Chunks wait in memory while the network is down (for example while
 * the phone is locked and the tab is throttled).
 */
export function createChunkUploader(
  recordingId: string,
  onPendingChange: (pending: number) => void,
) {
  const queue: PendingChunk[] = [];
  let nextSeq = 0;
  let pumping = false;
  let drainWaiters: Array<() => void> = [];

  const settleIfDrained = () => {
    if (queue.length > 0 || pumping) return;
    const waiters = drainWaiters;
    drainWaiters = [];
    for (const resolve of waiters) resolve();
  };

  const uploadOnce = async (chunk: PendingChunk): Promise<boolean> => {
    const response = await fetch(
      docAudioChunkUrl(recordingId, chunk.seq, chunk.elapsedMs),
      {
        method: "POST",
        body: chunk.blob,
        headers: { "content-type": "application/octet-stream" },
      },
    );
    if (response.ok) return true;
    if (response.status === 409) {
      // The server already holds this seq (a lost response), or wants an
      // earlier one, which never happens with in-order uploads.
      const body = (await response.json().catch(() => ({}))) as {
        chunkCount?: number;
      };
      if (typeof body.chunkCount === "number" && body.chunkCount > chunk.seq) {
        return true;
      }
    }
    throw new Error(`chunk ${chunk.seq} upload failed: ${response.status}`);
  };

  const pump = async () => {
    if (pumping) return;
    pumping = true;
    let backoff = 1_000;
    while (queue.length > 0) {
      const chunk = queue[0]!;
      try {
        await uploadOnce(chunk);
        queue.shift();
        onPendingChange(queue.length);
        backoff = 1_000;
      } catch (e) {
        console.warn("[audio-recorder] retrying upload", e);
        await new Promise((r) => setTimeout(r, backoff));
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      }
    }
    pumping = false;
    settleIfDrained();
  };

  return {
    push(blob: Blob, elapsedMs: number) {
      if (blob.size === 0) return;
      queue.push({ seq: nextSeq++, blob, elapsedMs });
      onPendingChange(queue.length);
      void pump();
    },
    /** Resolves once every queued chunk is stored on the server. */
    drained(): Promise<void> {
      return new Promise((resolve) => {
        drainWaiters.push(resolve);
        settleIfDrained();
      });
    },
  };
}
