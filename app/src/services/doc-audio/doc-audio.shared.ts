export type DocAudioSummary = {
  id: string;
  docId: string;
  label: string | null;
  mimeType: string;
  status: "recording" | "ready";
  sizeBytes: number;
  durationMs: number;
  createdAt: string;
  updatedAt: string;
  transcriptStatus: "none" | "pending" | "done" | "failed";
  transcriptError: string | null;
  transcriptAnalysis: TranscriptAnalysis | null;
};

/** One timed piece of the raw transcript; times in seconds. */
export type TranscriptSegment = { start: number; end: number; text: string };

/**
 * Output of the plan pass over a transcript, ported from the voice-to-context
 * (v2ctx) `transcript_plan` prompt plus a tasks array. Section times are
 * `hh:mm:ss.mmm` stamps copied from the timestamped transcript.
 */
export type TranscriptAnalysis = {
  title: string;
  summary: string;
  topBullets: string[];
  themes: string[];
  sections: {
    title: string;
    summary: string;
    start: string;
    end: string;
    cleanedText: string;
  }[];
  tasks: { text: string; excerpt: string }[];
};

/** Seconds from an `hh:mm:ss(.mmm)` or `mm:ss` stamp; 0 when unreadable. */
export const stampSeconds = (stamp: string) => {
  const parts = stamp.replace(",", ".").split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  return parts.reduce((total, n) => total * 60 + n, 0);
};

/** `m:ss` or `h:mm:ss` for display next to a section. */
export const formatStamp = (seconds: number) => {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

/** Markdown for one recording's cleaned transcript, with section stamps. */
export const transcriptMarkdown = (analysis: TranscriptAnalysis) =>
  analysis.sections
    .map(
      (s) =>
        `### [${formatStamp(stampSeconds(s.start))}] ${s.title}\n\n${s.cleanedText.trim()}`,
    )
    .join("\n\n");

export const docAudioUrl = (id: string) => `/api/doc-audio/${id}`;
export const docAudioChunkUrl = (id: string, seq: number, elapsedMs: number) =>
  `/api/doc-audio/${id}/chunks?seq=${seq}&elapsedMs=${Math.round(elapsedMs)}`;

export const DOC_AUDIO_LABEL_MAX = 120;

// Dropped recordings: Groq's Whisper accepts up to 100 MB per file.
export const DOC_AUDIO_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;
export const DOC_AUDIO_UPLOAD_URL = "/api/doc-audio";

/** Stored audio types and the extension each file is saved under. */
export const AUDIO_EXTENSION_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/flac": "flac",
};

// Names browsers give dropped files (macOS Voice Memos are `audio/x-m4a`).
const MIME_ALIASES: Record<string, string> = {
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/mp3": "audio/mpeg",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/vnd.wave": "audio/wav",
  "audio/x-flac": "audio/flac",
};

// For files the browser gives no usable type.
const MIME_BY_EXTENSION: Record<string, string> = {
  m4a: "audio/mp4",
  aac: "audio/aac",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  webm: "audio/webm",
  flac: "audio/flac",
};

/** Base MIME type without codec parameters, or null when unsupported. */
export function normalizeAudioMimeType(raw: string): string | null {
  const lower = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  const base = MIME_ALIASES[lower] ?? lower;
  return base in AUDIO_EXTENSION_BY_MIME ? base : null;
}

/** The stored type for a dropped file, from its type or its extension. */
export function audioMimeFor(file: { name: string; type: string }) {
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? "";
  return normalizeAudioMimeType(file.type) ?? MIME_BY_EXTENSION[ext] ?? null;
}

/** True for a file the strip can keep as a recording (Voice Memos, mp3, …). */
export const isAudioFile = (file: { name: string; type: string }) =>
  audioMimeFor(file) !== null;
