import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Job, JobStage, JobType } from "../lib/job-types";
import { isActiveStage } from "../lib/job-types";
import { publishJobUpdate } from "./job-events";

const nowIso = () => new Date().toISOString();
const id = () => crypto.randomUUID();

type JobListener = (job: Job) => void;

const listeners = new Set<JobListener>();

const notifyJobUpdate = (job: Job) => {
  console.log("jobs-db:notifyJobUpdate", {
    jobId: job.id,
    listeners: listeners.size,
  });
  if (listeners.size === 0) return;
  for (const listener of listeners) {
    try {
      console.log("jobs-db:notifyJobUpdate:listener", {
        jobId: job.id,
        listenerId: listener.name,
      });
      listener(job);
    } catch (err) {
      console.error("jobs-db:listener:error", err);
    }
  }
};

function getJobsDirPath() {
  return path.join(process.cwd(), "data", "jobs");
}

class JobsDb {
  private writeQueue: Promise<void> = Promise.resolve();

  private getJobFilePath(jobId: string) {
    return path.join(getJobsDirPath(), `${jobId}.json`);
  }

  private async readJobFile(jobId: string): Promise<Job | null> {
    const filePath = this.getJobFilePath(jobId);
    try {
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw) as Job;
    } catch (err: unknown) {
      const nodeErr = err as { code?: string };
      if (nodeErr?.code === "ENOENT") return null;
      throw err;
    }
  }

  private async writeJobFile(jobId: string, data: Job): Promise<void> {
    const filePath = this.getJobFilePath(jobId);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
  }

  private async mutateJob<T>(
    jobId: string,
    fn: (data: Job) => T | Promise<T>
  ): Promise<T> {
    let result!: T;
    this.writeQueue = this.writeQueue.then(async () => {
      const data = await this.readJobFile(jobId);
      if (!data) throw new Error("Job not found");
      result = await fn(data);
      await this.writeJobFile(jobId, data);
      notifyJobUpdate(data);
      publishJobUpdate(data);
    });
    await this.writeQueue;
    return result;
  }

  async createJob(type: JobType, sessionId: string | null): Promise<Job> {
    const jobId = id();
    const job: Job = {
      id: jobId,
      type,
      sessionId,
      stage: "pending",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
      stageStartedAt: null,
      error: null,
      retryCount: 0,
      resultSessionId: null,
    };

    this.writeQueue = this.writeQueue.then(async () => {
      await this.writeJobFile(jobId, job);
    });
    await this.writeQueue;
    console.log("jobs-db:createJob", { jobId, type, sessionId });
    notifyJobUpdate(job);
    publishJobUpdate(job);
    return job;
  }

  async getJob(jobId: string): Promise<Job | null> {
    return this.readJobFile(jobId);
  }

  async updateJob(jobId: string, patch: Partial<Job>): Promise<Job> {
    return this.mutateJob(jobId, (job) => {
      Object.assign(job, patch);
      job.updatedAt = nowIso();
      return job;
    });
  }

  async updateJobStage(jobId: string, stage: JobStage): Promise<Job> {
    console.log("jobs-db:updateJobStage", { jobId, stage });
    return this.mutateJob(jobId, (job) => {
      job.stage = stage;
      job.stageStartedAt = nowIso();
      job.updatedAt = nowIso();
      return job;
    });
  }

  async completeJob(jobId: string, resultSessionId?: string): Promise<Job> {
    console.log("jobs-db:completeJob", { jobId, resultSessionId });
    return this.mutateJob(jobId, (job) => {
      job.stage = "completed";
      job.completedAt = nowIso();
      job.updatedAt = nowIso();
      if (resultSessionId) {
        job.resultSessionId = resultSessionId;
      }
      return job;
    });
  }

  async failJob(jobId: string, error: string): Promise<Job> {
    console.log("jobs-db:failJob", { jobId, error });
    return this.mutateJob(jobId, (job) => {
      job.stage = "failed";
      job.error = error;
      job.updatedAt = nowIso();
      return job;
    });
  }

  async listActiveJobs(): Promise<Job[]> {
    const dir = getJobsDirPath();
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile() && e.name.endsWith(".json"))
        .map((e) => e.name.slice(0, -".json".length));

      const jobs: Job[] = [];
      for (const jobId of files) {
        const job = await this.readJobFile(jobId);
        if (job && isActiveStage(job.stage)) {
          jobs.push(job);
        }
      }
      return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (err: unknown) {
      const nodeErr = err as { code?: string };
      if (nodeErr?.code === "ENOENT") return [];
      throw err;
    }
  }

  async listAllJobs(): Promise<Job[]> {
    const dir = getJobsDirPath();
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile() && e.name.endsWith(".json"))
        .map((e) => e.name.slice(0, -".json".length));

      const jobs: Job[] = [];
      for (const jobId of files) {
        const job = await this.readJobFile(jobId);
        if (job) {
          jobs.push(job);
        }
      }
      return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (err: unknown) {
      const nodeErr = err as { code?: string };
      if (nodeErr?.code === "ENOENT") return [];
      throw err;
    }
  }

  async incrementRetryCount(jobId: string): Promise<Job> {
    return this.mutateJob(jobId, (job) => {
      job.retryCount += 1;
      job.error = null;
      job.stage = "pending";
      job.updatedAt = nowIso();
      return job;
    });
  }

  onJobUpdate(listener: JobListener) {
    listeners.add(listener);
    console.log("jobs-db:listener:add", { listeners: listeners.size });
    return () => {
      listeners.delete(listener);
      console.log("jobs-db:listener:remove", { listeners: listeners.size });
    };
  }
}

let singleton: JobsDb | null = null;

export function jobsDb() {
  if (!singleton) singleton = new JobsDb();
  return singleton;
}
