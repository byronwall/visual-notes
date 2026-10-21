import { prisma } from "~/server/db";
import { appendAudioChunk } from "./doc-audio-storage";

export type ChunkResult =
  | { ok: true; chunkCount: number; duplicate: boolean }
  | { ok: false; status: number; error: string; chunkCount?: number };

// Chunks for one recording are applied one at a time so retries and
// overlapping requests cannot interleave writes to the same file.
const queues = new Map<string, Promise<unknown>>();

function serialize<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(run);
  queues.set(key, next);
  void next.finally(() => {
    if (queues.get(key) === next) queues.delete(key);
  });
  return next;
}

/**
 * Append chunk `seq` to a recording. A seq already stored is acknowledged
 * without writing (a retry whose response was lost); a gap is rejected so the
 * client resends from the expected seq.
 */
export function appendDocAudioChunk(input: {
  id: string;
  seq: number;
  elapsedMs: number;
  chunk: Uint8Array;
}): Promise<ChunkResult> {
  return serialize(input.id, async () => {
    const row = await prisma.docAudio.findUnique({
      where: { id: input.id },
      select: { fileName: true, chunkCount: true, durationMs: true },
    });
    if (!row) return { ok: false, status: 404, error: "Recording not found" };
    if (input.seq < row.chunkCount) {
      return { ok: true, chunkCount: row.chunkCount, duplicate: true };
    }
    if (input.seq > row.chunkCount) {
      return {
        ok: false,
        status: 409,
        error: `Expected chunk ${row.chunkCount}`,
        chunkCount: row.chunkCount,
      };
    }
    const sizeBytes = await appendAudioChunk(row.fileName, input.chunk);
    const updated = await prisma.docAudio.update({
      where: { id: input.id },
      data: {
        chunkCount: row.chunkCount + 1,
        sizeBytes,
        durationMs: Math.max(row.durationMs, input.elapsedMs),
      },
      select: { chunkCount: true },
    });
    return { ok: true, chunkCount: updated.chunkCount, duplicate: false };
  });
}
