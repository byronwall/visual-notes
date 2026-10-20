import type { Job } from "../lib/job-types";
import { createBroadcastBus } from "./broadcast-bus";

const bus = createBroadcastBus<Job>("jobs-updates");

export const publishJobUpdate = (job: Job) => {
  bus.publish(job);
};

export const subscribeJobUpdates = bus.subscribe;
