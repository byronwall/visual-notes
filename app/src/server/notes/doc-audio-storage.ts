import { appendFile, mkdir, open, stat, writeFile } from "node:fs/promises";
import path from "node:path";

// Note audio recordings live on disk next to doc-images; the DocAudio row
// holds the metadata. Files are append-only while a recording is active.

export function resolveDocAudioStorageDir(): string {
  const fromEnv = process.env.DOC_AUDIO_STORAGE_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), "data", "doc-audio");
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/** Base MIME type without codec parameters, or null when unsupported. */
export function normalizeAudioMimeType(raw: string): string | null {
  const base = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  return base in EXTENSION_BY_MIME ? base : null;
}

export function audioFileNameFor(id: string, mimeType: string): string {
  return `${id}.${EXTENSION_BY_MIME[mimeType] ?? "bin"}`;
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
