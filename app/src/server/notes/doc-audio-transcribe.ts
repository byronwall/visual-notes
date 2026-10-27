import { openAsBlob } from "node:fs";
import path from "node:path";
import { Prisma, type DocAudio } from "@prisma/client";
import { prisma } from "~/server/db";
import { callLLM } from "~/server/lib/ai";
import type {
  TranscriptAnalysis,
  TranscriptSegment,
} from "~/services/doc-audio/doc-audio.shared";
import { transcriptMarkdown } from "~/services/doc-audio/doc-audio.shared";
import { audioFileSize, resolveDocAudioStorageDir } from "./doc-audio-storage";
import { scheduleEmbeddingRefresh } from "./embedding-refresh";

const LOG = "[doc-audio-transcribe]";

// Groq is the default: Whisper large-v3 turbo at ~$0.04/hour with a 100 MB
// upload limit. Without a Groq key, OpenAI's whisper-1 is the fallback; it
// returns the same verbose_json segments but caps uploads at 25 MB.
const PROVIDERS = {
  groq: {
    url: "https://api.groq.com/openai/v1/audio/transcriptions",
    model: "whisper-large-v3-turbo",
    maxBytes: 100 * 1024 * 1024,
    key: () => process.env.GROQ_API_KEY,
  },
  openai: {
    url: "https://api.openai.com/v1/audio/transcriptions",
    model: "whisper-1",
    maxBytes: 25 * 1024 * 1024,
    key: () => process.env.OPENAI_API_KEY,
  },
};

const ANALYSIS_MODEL = process.env.TRANSCRIPT_LLM_MODEL || "gpt-5.4-mini";

// Whisper's prompt biases spelling toward these terms (it reads ~224 tokens).
// Without it, "Groq", "VPS", and "UMAP" come back as "Grok", "VPs", "UMAT".
const VOCABULARY =
  process.env.TRANSCRIPT_VOCABULARY ||
  "Visual Notes, MCP, Groq, VPS, Coolify, UMAP, SolidJS, SolidStart, Prisma, TipTap, Panda, Codex, Claude, Playwright, pnpm, GitHub, PR.";

function pickProvider() {
  if (PROVIDERS.groq.key()) return PROVIDERS.groq;
  if (PROVIDERS.openai.key()) return PROVIDERS.openai;
  return null;
}

export const canTranscribe = () => pickProvider() !== null;

async function transcribeFile(row: DocAudio) {
  const provider = pickProvider();
  if (!provider) throw new Error("Set GROQ_API_KEY or OPENAI_API_KEY");
  const size = await audioFileSize(row.fileName);
  if (size > provider.maxBytes) {
    const mb = Math.round(size / 1024 / 1024);
    throw new Error(
      `Recording is ${mb} MB; ${provider.model} accepts at most ${provider.maxBytes / 1024 / 1024} MB`,
    );
  }
  const form = new FormData();
  // openAsBlob reads the file as it uploads, so a long memo is never held
  // in memory whole on the VPS.
  const file = await openAsBlob(
    path.join(resolveDocAudioStorageDir(), row.fileName),
    { type: row.mimeType },
  );
  form.append("file", file, row.fileName);
  form.append("model", provider.model);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.append("prompt", VOCABULARY);
  const res = await fetch(provider.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.key()}` },
    body: form,
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${provider.model} ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = JSON.parse(body) as {
    text?: string;
    segments?: { start: number; end: number; text: string }[];
  };
  const segments: TranscriptSegment[] = (json.segments ?? []).map((s) => ({
    start: s.start,
    end: s.end,
    text: s.text.trim(),
  }));
  return { text: (json.text ?? "").trim(), segments, model: provider.model };
}

const clock = (seconds: number) => {
  const ms = Math.round(seconds * 1000);
  const h = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${s}.${String(ms % 1000).padStart(3, "0")}`;
};

// Prompt text and schema are ported from voice-to-context
// (cli/llm-analysis.js, transcript-llm-analysis@2026-07-03.1): the shared
// instructions plus the plan pass. Tasks ride along so one call covers v1.
const PROMPT_VERSION = "visual-notes-transcript-plan@2026-10-26.1";

const SHARED_INSTRUCTIONS = [
  "You analyze a full timestamped voice memo transcript.",
  "Treat the transcript message as the stable shared context for all tasks in this run.",
  "Ground every answer in that transcript and preserve timestamp/source references when requested.",
  "Do not invent facts, examples, tasks, opinions, project names, or certainty.",
].join("\n");

const PLAN_TASK = [
  "Task: determine the semantic sections for this entire voice memo transcript.",
  "Use the full context to choose boundaries by meaning, not by fixed pauses or cue phrases.",
  "Return a concise package title, summary, top bullets, themes, and ordered sections.",
  // Not in v2ctx: the title also names the note, so keep it short.
  "Keep the title under 8 words, like a note title.",
  "Each section must include start and end timestamps that exist within the transcript range, a specific title, a short summary, and cleanedText for that section.",
  "Also extract tasks: concrete actions, implementation ideas, decisions to make, or follow-up work.",
  "Each task must include a short primary excerpt copied from the transcript.",
  "Leave tasks empty when the transcript does not contain grounded entries.",
].join("\n");

const stringList = { type: "array", items: { type: "string" } };

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "topBullets", "themes", "sections", "tasks"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    topBullets: stringList,
    themes: stringList,
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "summary", "start", "end", "cleanedText"],
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          start: { type: "string" },
          end: { type: "string" },
          cleanedText: { type: "string" },
        },
      },
    },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "excerpt"],
        properties: {
          text: { type: "string" },
          excerpt: { type: "string" },
        },
      },
    },
  },
};

async function analyzeTranscript(
  docId: string,
  segments: TranscriptSegment[],
): Promise<TranscriptAnalysis> {
  const last = segments.at(-1);
  const transcript = [
    "Full timestamped transcript:",
    `Range: ${clock(0)} - ${clock(last?.end ?? 0)}`,
    "",
    ...segments.map((s) => `[${clock(s.start)} - ${clock(s.end)}] ${s.text}`),
  ].join("\n");
  const { output } = await callLLM({
    model: ANALYSIS_MODEL,
    system: SHARED_INSTRUCTIONS,
    user: `${transcript}\n\n${PLAN_TASK}`,
    noteId: docId,
    schema: { name: "transcript_plan", schema: PLAN_SCHEMA },
  });
  if (!output) throw new Error("Transcript analysis returned nothing");
  return JSON.parse(output) as TranscriptAnalysis;
}

/** Placeholder titles the recorder gives new voice notes. */
const isPlaceholderTitle = (title: string) =>
  !title.trim() || /^Voice note · /.test(title) || title === "Untitled note";

/**
 * Rebuilds `Doc.audioText` from every transcribed recording on the note and
 * renames a still-untitled voice note after its first recording's analysis.
 */
async function refreshDocAudioText(docId: string) {
  const audios = await prisma.docAudio.findMany({
    where: { docId, transcriptStatus: "done" },
    orderBy: { createdAt: "asc" },
    select: { transcriptAnalysis: true },
  });
  const analyses = audios.flatMap((a) =>
    a.transcriptAnalysis ? [a.transcriptAnalysis as TranscriptAnalysis] : [],
  );
  const audioText = analyses
    .map((a) => `## ${a.title}\n\n${a.summary}\n\n${transcriptMarkdown(a)}`)
    .join("\n\n");
  const doc = await prisma.doc.findUnique({
    where: { id: docId },
    select: { title: true },
  });
  if (!doc) return;
  const title =
    analyses[0]?.title && isPlaceholderTitle(doc.title)
      ? analyses[0].title
      : undefined;
  await prisma.doc.update({
    where: { id: docId },
    data: { audioText: audioText || null, ...(title ? { title } : {}) },
  });
  scheduleEmbeddingRefresh();
}

async function transcribe(id: string) {
  const row = await prisma.docAudio.findUnique({ where: { id } });
  if (!row) return;
  await prisma.docAudio.update({
    where: { id },
    data: { transcriptStatus: "pending", transcriptError: null },
  });
  const started = Date.now();
  try {
    const result = await transcribeFile(row);
    if (!result.segments.length) throw new Error("No speech found");
    const analysis = await analyzeTranscript(row.docId, result.segments);
    await prisma.docAudio.update({
      where: { id },
      data: {
        transcriptStatus: "done",
        transcriptRaw: result.text,
        transcriptSegments: result.segments,
        transcriptAnalysis: analysis,
        transcriptModel: `${result.model} + ${ANALYSIS_MODEL} (${PROMPT_VERSION})`,
        transcribedAt: new Date(),
      },
    });
    await refreshDocAudioText(row.docId);
    console.info(
      `${LOG} done %s: %d segments, %d sections, %d tasks in %dms`,
      id,
      result.segments.length,
      analysis?.sections.length ?? 0,
      analysis?.tasks.length ?? 0,
      Date.now() - started,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${LOG} failed %s: %s`, id, message);
    await prisma.docAudio.update({
      where: { id },
      data: {
        transcriptStatus: "failed",
        transcriptError: message,
        transcriptAnalysis: Prisma.JsonNull,
      },
    });
  }
}

// One transcription at a time keeps the VPS and the API rate limits calm.
let queue: Promise<void> = Promise.resolve();
const queued = new Set<string>();

/** Queues a recording for transcription; repeats while queued are ignored. */
export function queueTranscription(id: string) {
  if (!canTranscribe()) {
    console.info(`${LOG} skipped %s: no transcription key`, id);
    return;
  }
  if (queued.has(id)) return;
  queued.add(id);
  queue = queue.then(() => transcribe(id)).finally(() => queued.delete(id));
}

// A recording left in `recording` this long was interrupted, not active.
const STALE_RECORDING_MS = 15 * 60_000;

/**
 * Boot pass: transcribes finished recordings that never were (older rows,
 * restarts mid-job) and interrupted recordings that went quiet.
 */
export async function resumeTranscriptions() {
  if (process.env.NODE_ENV === "test" || !canTranscribe()) return;
  const rows = await prisma.docAudio.findMany({
    where: {
      transcriptStatus: { in: ["none", "pending"] },
      sizeBytes: { gt: 0 },
      OR: [
        { status: "ready" },
        { updatedAt: { lt: new Date(Date.now() - STALE_RECORDING_MS) } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (rows.length) console.info(`${LOG} resuming %d recordings`, rows.length);
  for (const row of rows) queueTranscription(row.id);
}
