import type { Job } from "~/lib/job-types";

export type JobSocketInitMessage = {
  type: "jobs:init";
  jobs: Job[];
};

export type JobSocketUpdateMessage = {
  type: "jobs:update";
  job: Job;
};

export type JobSocketServerMessage =
  | JobSocketInitMessage
  | JobSocketUpdateMessage;

export type JobSocketClientMessage = {
  type: "jobs:ping";
  at: string;
};
