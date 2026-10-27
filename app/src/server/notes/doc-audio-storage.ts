import { createWriteStream } from "node:fs";
import { appendFile, mkdir, open, rm, stat, writeFile } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import {
  AUDIO_EXTENSION_BY_MIME,
  normalizeAudioMimeType,
} from "~/services/doc-audio/doc-audio.shared";
import path from "node:path";

// Note audio recordings live on disk next to doc-images; the DocAudio row
// holds the metadata. Files are append-only while a recording is active.

export function resolveDocAudioStorageDir(): string {
  const fromEnv = process.env.DOC_AUDIO_STORAGE_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), "data", "doc-audio");
}

export { normalizeAudioMimeType };

export function audioFileNameFor(id: string, mimeType: string): string {
  return `${id}.${AUDIO_EXTENSION_BY_MIME[mimeType] ?? "bin"}`;
}

const VALID_FILE_NAME = /^[a-z0-9]+\.[a-z0-9]+$/;

function resolveAudioPath(fileName: string): string {
  if (!VALID_FILE_NAME.test(fileName)) {
    throw new Error(`Invalid audio file name: ${fileName}`);
  }
  return path.join(resolveDocAudioStorageDir(), fileName);
}

export async function createAudioFile(fileName: string): Promise<void> {
  await mkdir(resolveDocAudioStorageDir(), { recursive: true });
  await writeFile(resolveAudioPath(fileName), new Uint8Array(0), {
    flag: "wx",
  });
}

export async function appendAudioChunk(
  fileName: string,
  chunk: Uint8Array,
): Promise<number> {
  const abs = resolveAudioPath(fileName);
  await appendFile(abs, chunk);
  return (await stat(abs)).size;
}

export class AudioTooLargeError extends Error {}

/**
 * Streams a whole file (a dropped recording) to disk and returns its size.
 * Stops at `maxBytes` and removes what it wrote on any failure.
 */
export async function writeAudioFile(
  fileName: string,
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<number> {
  await mkdir(resolveDocAudioStorageDir(), { recursive: true });
  const abs = resolveAudioPath(fileName);
  let size = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _enc, done) {
      size += chunk.length;
      if (size > maxBytes) return done(new AudioTooLargeError());
      done(null, chunk);
    },
  });
  try {
    await pipeline(
      Readable.fromWeb(body as WebReadableStream),
      limit,
      createWriteStream(abs, { flags: "wx" }),
    );
    return size;
  } catch (error) {
    await rm(abs, { force: true });
    throw error;
  }
}

export async function removeAudioFile(fileName: string): Promise<void> {
  await rm(resolveAudioPath(fileName), { force: true });
}

export async function audioFileSize(fileName: string): Promise<number> {
  return (await stat(resolveAudioPath(fileName))).size;
}

/** Read `[start, end]` (inclusive) from an audio file. */
export async function readAudioRange(
  fileName: string,
  start: number,
  end: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const handle = await open(resolveAudioPath(fileName), "r");
  try {
    const length = end - start + 1;
    const buffer = new Uint8Array(length);
    await handle.read(buffer, 0, length, start);
    return buffer;
  } finally {
    await handle.close();
  }
}

export type ByteRange = { start: number; end: number };

/** Parse a single `bytes=` Range header; null means serve the whole file. */
export function parseByteRange(
  header: string | null,
  size: number,
): ByteRange | "unsatisfiable" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;
  let start: number;
  let end: number;
  if (!rawStart) {
    // Suffix range: the last N bytes.
    const suffix = Number(rawEnd);
    if (suffix === 0) return "unsatisfiable";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1;
  }
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}
