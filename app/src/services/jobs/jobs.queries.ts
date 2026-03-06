import { query } from "@solidjs/router";
import { jobsDb } from "~/server/jobs-db";
import {
  JOB_TYPE_LABELS,
  STAGE_LABELS,
  getStageProgress,
  type Job,
} from "~/lib/job-types";

export type JobStatus = {
  id: string;
  type: Job["type"];
  typeLabel: string;
  stage: Job["stage"];
  stageLabel: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  error: string | null;
  resultSessionId: string | null;
};

export const fetchJobStatus = query(
  async (jobId: string): Promise<JobStatus | null> => {
    "use server";
    const id = String(jobId || "").trim();
    if (!id) return null;
    const job = await jobsDb().getJob(id);
    if (!job) return null;

    return {
      id: job.id,
      type: job.type,
      typeLabel: JOB_TYPE_LABELS[job.type] ?? job.type,
      stage: job.stage,
      stageLabel: STAGE_LABELS[job.stage] ?? job.stage,
      progress: getStageProgress(job.stage),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      error: job.error,
      resultSessionId: job.resultSessionId,
    };
  },
  "job-status"
);
