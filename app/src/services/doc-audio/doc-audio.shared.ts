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
