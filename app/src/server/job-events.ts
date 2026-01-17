import { BroadcastChannel, isMainThread, threadId } from "node:worker_threads";

import type { Job } from "../lib/job-types";

type JobEventListener = (job: Job) => void;

const channel = new BroadcastChannel("jobs-updates");
const listeners = new Set<JobEventListener>();

type JobUpdateMessage = {
  type: "job:update";
  job: Job;
};

export const publishJobUpdate = (job: Job) => {
  const message: JobUpdateMessage = { type: "job:update", job };
  channel.postMessage(message);
};

const handleMessage = (event: unknown) => {
  const data = (event as { data?: JobUpdateMessage }).data;
  if (data?.type !== "job:update") return;
  listeners.forEach((listener) => listener(data.job));
};

channel.onmessage = handleMessage;

export const subscribeJobUpdates = (listener: JobEventListener) => {
  listeners.add(listener);
  console.log("job-events:subscribe", {
    pid: process.pid,
    thread: isMainThread ? "main" : threadId,
  });

  return () => {
    listeners.delete(listener);
    console.log("job-events:unsubscribe", {
      pid: process.pid,
      thread: isMainThread ? "main" : threadId,
    });
  };
};
