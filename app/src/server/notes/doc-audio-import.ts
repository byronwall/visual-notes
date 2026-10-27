import { randomUUID } from "node:crypto";
import { prisma } from "~/server/db";
import {
  DOC_AUDIO_LABEL_MAX,
  DOC_AUDIO_UPLOAD_MAX_BYTES,
  audioMimeFor,
} from "~/services/doc-audio/doc-audio.shared";
import {
  audioFileNameFor,
  removeAudioFile,
  writeAudioFile,
} from "./doc-audio-storage";
import { canTranscribe, queueTranscription } from "./doc-audio-transcribe";

/** "New Recording 12.m4a" → "New Recording 12". */
const labelFor = (name: string) =>
  name
    .replace(/\.[a-z0-9]+$/i, "")
    .trim()
    .slice(0, DOC_AUDIO_LABEL_MAX) || null;

/**
 * Stores a dropped audio file as a finished recording on a note and queues
 * its transcript. `recordedAt` (the file's modified time) orders it among
 * the note's other recordings.
 */
export async function importDocAudio(input: {
  docId: string;
  name: string;
  type: string;
  recordedAt: Date | null;
  durationMs: number;
  body: ReadableStream<Uint8Array>;
}) {
  const mimeType = audioMimeFor(input);
  if (!mimeType) throw new AudioImportError(`${input.name} is not audio`);
  const doc = await prisma.doc.findUnique({
    where: { id: input.docId },
    select: { id: true },
  });
  if (!doc) throw new AudioImportError("Note not found");

  const id = randomUUID().replace(/-/g, "");
  const fileName = audioFileNameFor(id, mimeType);
  const sizeBytes = await writeAudioFile(
    fileName,
    input.body,
    DOC_AUDIO_UPLOAD_MAX_BYTES,
  );
  let row;
  try {
    if (sizeBytes === 0) throw new AudioImportError(`${input.name} is empty`);
    row = await prisma.docAudio.create({
      data: {
        id,
        docId: doc.id,
        label: labelFor(input.name),
        mimeType,
        fileName,
        status: "ready",
        sizeBytes,
        durationMs: input.durationMs,
        ...(input.recordedAt ? { createdAt: input.recordedAt } : {}),
        ...(canTranscribe() ? { transcriptStatus: "pending" as const } : {}),
      },
    });
  } catch (error) {
    await removeAudioFile(fileName);
    throw error;
  }
  console.info(
    "[doc-audio] imported",
    row.id,
    "for doc",
    doc.id,
    `${sizeBytes} bytes`,
  );
  queueTranscription(row.id);
  return row;
}

/** A refusal the client should show as-is (not retry). */
export class AudioImportError extends Error {}
