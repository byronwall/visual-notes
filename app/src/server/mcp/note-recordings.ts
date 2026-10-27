import { prisma } from "~/server/db";
import {
  docAudioUrl,
  formatStamp,
  transcriptMarkdown,
  type TranscriptAnalysis,
  type TranscriptSegment,
} from "~/services/doc-audio/doc-audio.shared";
import { appLink, ConnectorError, type ConnectorContext } from "./shared";

// Audio recordings on a note, as agents see them: the plan-pass analysis and
// the cleaned transcript in notes_get, the raw timed text from
// notes_get_transcript.

/** Above this many transcript characters per note, notes_get sends a pointer. */
const MAX_INLINE_TRANSCRIPT_CHARS = 40_000;

export type NoteRecording = {
  id: string;
  label: string | null;
  createdAt: string;
  durationSeconds: number;
  /** Full web address of the audio file. */
  url: string;
  transcriptStatus: "none" | "pending" | "done" | "failed";
  transcriptError?: string;
  title?: string;
  summary?: string;
  topBullets?: string[];
  themes?: string[];
  tasks?: { text: string; excerpt: string }[];
  /** Cleaned text by section, each headed `### [m:ss] Section title`. */
  transcript?: string;
  /** Set when the transcript was too long to inline. */
  transcriptOmitted?: string;
};

export async function recordingsByNote(
  ctx: ConnectorContext,
  docIds: string[],
): Promise<Map<string, NoteRecording[]>> {
  const rows = await prisma.docAudio.findMany({
    where: { docId: { in: docIds } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      docId: true,
      label: true,
      createdAt: true,
      durationMs: true,
      transcriptStatus: true,
      transcriptError: true,
      transcriptAnalysis: true,
    },
  });
  const byNote = new Map<string, NoteRecording[]>();
  const chars = new Map<string, number>();
  for (const row of rows) {
    const analysis = row.transcriptAnalysis as TranscriptAnalysis | null;
    const recording: NoteRecording = {
      id: row.id,
      label: row.label,
      createdAt: row.createdAt.toISOString(),
      durationSeconds: Math.round(row.durationMs / 1000),
      url: appLink(ctx, docAudioUrl(row.id)),
      transcriptStatus: row.transcriptStatus,
      ...(row.transcriptError ? { transcriptError: row.transcriptError } : {}),
    };
    if (analysis) {
      const transcript = transcriptMarkdown(analysis);
      const used = (chars.get(row.docId) ?? 0) + transcript.length;
      chars.set(row.docId, used);
      Object.assign(recording, {
        title: analysis.title,
        summary: analysis.summary,
        topBullets: analysis.topBullets,
        themes: analysis.themes,
        tasks: analysis.tasks,
        ...(used <= MAX_INLINE_TRANSCRIPT_CHARS
          ? { transcript }
          : {
              transcriptOmitted: `Long transcript (${transcript.length} characters): call notes_get_transcript with recordingId ${row.id}.`,
            }),
      });
    }
    byNote.set(row.docId, [...(byNote.get(row.docId) ?? []), recording]);
  }
  return byNote;
}

export async function getTranscript(input: {
  recordingId: string;
  format?: "cleaned" | "raw";
}) {
  const row = await prisma.docAudio.findUnique({
    where: { id: input.recordingId },
    select: {
      id: true,
      docId: true,
      transcriptStatus: true,
      transcriptAnalysis: true,
      transcriptSegments: true,
    },
  });
  if (!row) {
    throw new ConnectorError(
      "not_found",
      `No recording with id ${input.recordingId}`,
    );
  }
  if (row.transcriptStatus !== "done") {
    throw new ConnectorError(
      "invalid",
      `Recording ${row.id} has no transcript yet (status: ${row.transcriptStatus})`,
    );
  }
  const format = input.format ?? "cleaned";
  const analysis = row.transcriptAnalysis as TranscriptAnalysis | null;
  const text =
    format === "cleaned" && analysis
      ? transcriptMarkdown(analysis)
      : ((row.transcriptSegments ?? []) as TranscriptSegment[])
          .map((s) => `[${formatStamp(s.start)}] ${s.text}`)
          .join("\n");
  return { recordingId: row.id, noteId: row.docId, format, text };
}
