import { eventHandler } from "vinxi/http";

import type { JobSocketServerMessage } from "../lib/job-socket-messages";
import type { Job } from "../lib/job-types";
import { jobsDb } from "../server/jobs-db";
import { subscribeJobUpdates } from "../server/job-events";

const sendMessage = (peer: Peer, message: JobSocketServerMessage) => {
  peer.send(JSON.stringify(message));
};

const peers = new Set<Peer>();
let unsubscribe: (() => void) | null = null;

const broadcastJob = (job: Job) => {
  for (const peer of peers) {
    try {
      sendMessage(peer, { type: "jobs:update", job });
    } catch (err) {
      console.error("job-socket:broadcast:error", { id: peer.id, err });
    }
  }
};

const ensureSubscription = () => {
  if (unsubscribe) return;
  unsubscribe = subscribeJobUpdates((job) => {
    broadcastJob(job);
  });
  console.log("job-socket:subscription:start");
};

const stopSubscriptionIfIdle = () => {
  if (peers.size > 0) return;
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
    console.log("job-socket:subscription:stop");
  }
};

type Peer = Parameters<
  NonNullable<
    NonNullable<Parameters<typeof eventHandler>[0]["__websocket__"]>["open"]
  >
>[0];

const handler = eventHandler({
  handler() {},
  websocket: {
    async open(peer) {
      peers.add(peer);
      console.log("job-socket:open", {
        id: peer.id,
        url: peer.request.url,
        peers: peers.size,
      });
      ensureSubscription();
      try {
        const activeJobs = await jobsDb().listActiveJobs();
        sendMessage(peer, { type: "jobs:init", jobs: activeJobs });
      } catch (err) {
        console.error("job-socket:init:error", err);
      }
    },
    close(peer, details) {
      peers.delete(peer);
      console.log("job-socket:close", {
        id: peer.id,
        url: peer.request.url,
        code: details.code,
        reason: details.reason,
        peers: peers.size,
      });
      stopSubscriptionIfIdle();
    },
    message(peer, message) {
      console.log("job-socket:message", {
        id: peer.id,
        url: peer.request.url,
        hasData: !!message,
      });
    },
    error(peer, error) {
      console.error("job-socket:error", {
        id: peer.id,
        url: peer.request.url,
        error,
      });
    },
  },
});

export default handler;
