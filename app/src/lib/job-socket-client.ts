import type {
  JobSocketClientMessage,
  JobSocketServerMessage,
} from "./job-socket-messages";
import {
  createSocketClient,
  type SocketClient,
  type SocketStatus,
} from "./socket-client";

export type JobSocketStatus = SocketStatus;

type JobSocketClientOptions = {
  path: string;
  onMessage: (message: JobSocketServerMessage) => void;
  onStatus?: (status: JobSocketStatus) => void;
};

export type JobSocketClient = SocketClient<JobSocketClientMessage>;

const parseJobMessage = (value: unknown): JobSocketServerMessage | null => {
  const type = (value as { type?: unknown } | null)?.type;
  return type === "jobs:init" || type === "jobs:update"
    ? (value as JobSocketServerMessage)
    : null;
};

export function createJobSocketClient(
  options: JobSocketClientOptions,
): JobSocketClient {
  return createSocketClient<JobSocketServerMessage, JobSocketClientMessage>({
    ...options,
    logPrefix: "job-socket",
    parse: parseJobMessage,
  });
}
