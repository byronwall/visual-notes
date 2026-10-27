import { action, json } from "@solidjs/router";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "~/server/db";
import {
  audioFileNameFor,
  audioFileSize,
  createAudioFile,
  normalizeAudioMimeType,
} from "~/server/notes/doc-audio-storage";
import { createNoteRecord } from "~/server/notes/create-note";
import {
  canTranscribe,
  queueTranscription,
  refreshDocAudioText,
} from "~/server/notes/doc-audio-transcribe";
import { fetchDocAudios, toDocAudioSummary } from "./doc-audio.queries";
import { DOC_AUDIO_LABEL_MAX, type TranscriptAnalysis } from "./doc-audio.shared";

const startInput = z.object({
  docId: z.string().min(1),
  mimeType: z.string().min(1).max(200),
});

const finishInput = z.object({
  id: z.string().min(1),
  durationMs: z.number().int().min(0),
});

const renameInput = z.object({
  id: z.string().min(1),
  label: z.string().max(DOC_AUDIO_LABEL_MAX),
});

export const startDocAudio = action(
  async (payload: z.infer<typeof startInput>) => {
    "use server";
    const input = startInput.parse(payload);
    const mimeType = normalizeAudioMimeType(input.mimeType);
    if (!mimeType) throw new Error(`Unsupported audio type: ${input.mimeType}`);
    const doc = await prisma.doc.findUnique({
      where: { id: input.docId },
      select: { id: true },
    });
    if (!doc) throw new Error("Note not found");

    const id = randomUUID().replace(/-/g, "");
    const fileName = audioFileNameFor(id, mimeType);
    await createAudioFile(fileName);
    const row = await prisma.docAudio.create({
      data: { id, docId: doc.id, mimeType, fileName },
    });
    console.info("[doc-audio] started", row.id, "for doc", doc.id, mimeType);
    return json(toDocAudioSummary(row), {
      revalidate: fetchDocAudios.keyFor(doc.id),
    });
  },
  "doc-audio-start",
);

export const finishDocAudio = action(
  async (payload: z.infer<typeof finishInput>) => {
    "use server";
    const input = finishInput.parse(payload);
    const existing = await prisma.docAudio.findUnique({
      where: { id: input.id },
    });
    if (!existing) throw new Error("Recording not found");
    const sizeBytes = await audioFileSize(existing.fileName);
    const row = await prisma.docAudio.update({
      where: { id: existing.id },
      data: {
        status: "ready",
        sizeBytes,
        durationMs: Math.max(existing.durationMs, input.durationMs),
        // Set here, not in the job, so the returned row already reads
        // pending and the strip starts polling for the transcript.
        ...(canTranscribe() ? { transcriptStatus: "pending" as const } : {}),
      },
    });
    console.info("[doc-audio] finished", row.id, `${sizeBytes} bytes`);
    queueTranscription(row.id);
    return json(toDocAudioSummary(row), {
      revalidate: fetchDocAudios.keyFor(row.docId),
    });
  },
  "doc-audio-finish",
);

/** Transcribes a recording again (or for the first time, if interrupted). */
export const transcribeDocAudio = action(async (id: string) => {
  "use server";
  if (!canTranscribe()) {
    throw new Error("Transcription needs GROQ_API_KEY or OPENAI_API_KEY");
  }
  const row = await prisma.docAudio.update({
    where: { id: z.string().min(1).parse(id) },
    data: { transcriptStatus: "pending", transcriptError: null },
  });
  queueTranscription(row.id);
  return json(toDocAudioSummary(row), {
    revalidate: fetchDocAudios.keyFor(row.docId),
  });
}, "doc-audio-transcribe");

export const renameDocAudio = action(
  async (payload: z.infer<typeof renameInput>) => {
    "use server";
    const input = renameInput.parse(payload);
    const label = input.label.trim();
    const row = await prisma.docAudio.update({
      where: { id: input.id },
      data: { label: label.length ? label : null },
    });
    return json(toDocAudioSummary(row), {
      revalidate: fetchDocAudios.keyFor(row.docId),
    });
  },
  "doc-audio-rename",
);

const moveInput = z.object({
  id: z.string().min(1),
  /** Target note; omit to create a new note for the recording. */
  toDocId: z.string().min(1).optional(),
});

/** Moves a recording and its transcript to another note, or to a new one. */
export const moveDocAudio = action(
  async (payload: z.infer<typeof moveInput>) => {
    "use server";
    const input = moveInput.parse(payload);
    const row = await prisma.docAudio.findUnique({
      where: { id: input.id },
      include: { doc: { select: { path: true } } },
    });
    if (!row) throw new Error("Recording not found");
    let toDocId = input.toDocId;
    if (toDocId) {
      const target = await prisma.doc.findUnique({
        where: { id: toDocId },
        select: { id: true },
      });
      if (!target) throw new Error("Note not found");
    } else {
      const analysis = row.transcriptAnalysis as TranscriptAnalysis | null;
      const title =
        row.label ??
        analysis?.title ??
        `Voice note · ${row.createdAt.toISOString().slice(0, 10)}`;
      const created = await createNoteRecord({
        title,
        markdown: `# ${title}\n`,
        path: row.doc.path ?? undefined,
      });
      toDocId = created.id;
    }
    if (toDocId === row.docId) return json({ docId: toDocId });
    await prisma.docAudio.update({
      where: { id: row.id },
      data: { docId: toDocId },
    });
    await refreshDocAudioText(row.docId);
    await refreshDocAudioText(toDocId);
    console.info("[doc-audio] moved", row.id, "from", row.docId, "to", toDocId);
    return json(
      { docId: toDocId },
      {
        revalidate: [
          fetchDocAudios.keyFor(row.docId),
          fetchDocAudios.keyFor(toDocId),
        ],
      },
    );
  },
  "doc-audio-move",
);
