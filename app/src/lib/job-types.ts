export type JobType =
  | "create_session"
  | "submit_answers"
  | "create_next_round"
  | "add_more_questions";

export type JobStage =
  | "pending"
  | "extract"
  | "analyze"
  | "generate"
  | "finalize"
  | "completed"
  | "failed";

export type Job = {
  id: string;
  type: JobType;
  sessionId: string | null;
  stage: JobStage;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  stageStartedAt: string | null;
  error: string | null;
  retryCount: number;
  resultSessionId: string | null;
};

export type EtaBand = {
  min: number;
  max: number;
  label: string;
};

export const JOB_ETA_BANDS: Record<JobType, EtaBand> = {
  create_session: { min: 30000, max: 120000, label: "Usually ~30s-2min" },
  submit_answers: { min: 20000, max: 90000, label: "Usually ~30s-1.5min" },
  create_next_round: { min: 20000, max: 90000, label: "Usually ~30s-1.5min" },
  add_more_questions: { min: 15000, max: 60000, label: "Usually ~15s-1min" },
};

export const STAGE_PROGRESS: Record<JobStage, number> = {
  pending: 0,
  extract: 15,
  analyze: 40,
  generate: 75,
  finalize: 95,
  completed: 100,
  failed: 0,
};

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  create_session: "Creating session",
  submit_answers: "Generating result",
  create_next_round: "Creating next round",
  add_more_questions: "Adding questions",
};

export const STAGE_LABELS: Record<JobStage, string> = {
  pending: "Queued",
  extract: "Extracting",
  analyze: "Analyzing",
  generate: "Generating",
  finalize: "Finalizing",
  completed: "Completed",
  failed: "Failed",
};

export const STALL_THRESHOLD_MS = 60000;

export function isActiveStage(stage: JobStage): boolean {
  return !["completed", "failed"].includes(stage);
}

export function getStageProgress(stage: JobStage): number {
  return STAGE_PROGRESS[stage];
}
