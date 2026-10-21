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
};

export const docAudioUrl = (id: string) => `/api/doc-audio/${id}`;
export const docAudioChunkUrl = (id: string, seq: number, elapsedMs: number) =>
  `/api/doc-audio/${id}/chunks?seq=${seq}&elapsedMs=${Math.round(elapsedMs)}`;

export const DOC_AUDIO_LABEL_MAX = 120;
