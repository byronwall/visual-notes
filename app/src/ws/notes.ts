import { eventHandler } from "vinxi/http";

import {
  NOTE_SOCKET_DISABLED_CLOSE_CODE,
  type NoteSocketServerMessage,
} from "../lib/note-events";
import { serverEnv } from "../env/server";
import { isRequestAuthenticated } from "../server/magic-auth";
import { subscribeNoteChanges } from "../server/note-events";

type Hooks = NonNullable<Parameters<typeof eventHandler>[0]["__websocket__"]>;
type Peer = Parameters<NonNullable<Hooks["open"]>>[0];

// Below common reverse-proxy idle timeouts (often 60s) so idle sockets stay up.
const HEARTBEAT_MS = 25_000;
const UNAUTHORIZED_CLOSE_CODE = 4401;

const isDisabled = () => serverEnv.NOTE_LIVE_SYNC === "false";

const peers = new Set<Peer>();
let unsubscribe: (() => void) | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;

const isAuthed = (request: { headers: Headers }) =>
  isRequestAuthenticated(request as Request);

const send = (peer: Peer, message: NoteSocketServerMessage) => {
  try {
    peer.send(JSON.stringify(message));
  } catch (err) {
    console.error("[note-socket] send failed", { id: peer.id, err });
  }
};

const broadcast = (message: NoteSocketServerMessage) => {
  for (const peer of peers) send(peer, message);
};

const start = () => {
  if (!unsubscribe) {
    unsubscribe = subscribeNoteChanges((event) => {
      console.debug("[note-socket] broadcast", {
        peers: peers.size,
        type: event.type,
        changes:
          (event.type === "app:changed" ? event.ids : event.changes)?.length ??
          "all",
      });
      broadcast(event);
    });
  }
  if (!heartbeat) {
    heartbeat = setInterval(() => {
      broadcast({ type: "notes:ping", at: new Date().toISOString() });
    }, HEARTBEAT_MS);
    heartbeat.unref?.();
  }
};

const stopIfIdle = () => {
  if (peers.size > 0) return;
  unsubscribe?.();
  unsubscribe = null;
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
};

const handler = eventHandler({
  handler() {},
  websocket: {
    upgrade(request) {
      // The app middleware does not run for this router, so check the
      // magic-session cookie here before accepting the socket.
      if (!isAuthed(request)) {
        console.warn("[note-socket] rejected unauthenticated upgrade");
        throw new Response("Unauthorized", { status: 401 });
      }
    },
    open(peer) {
      // Accept, then close with a code the client treats as "stop retrying";
      // a refused upgrade looks like a network error and would be retried.
      if (isDisabled()) {
        peer.close(NOTE_SOCKET_DISABLED_CLOSE_CODE, "live sync disabled");
        return;
      }
      if (!isAuthed(peer.request)) {
        peer.close(UNAUTHORIZED_CLOSE_CODE, "unauthorized");
        return;
      }
      peers.add(peer);
      console.info("[note-socket] open", { id: peer.id, peers: peers.size });
      start();
      // Greets right away so the client knows this socket reached the handler.
      send(peer, { type: "notes:ping", at: new Date().toISOString() });
    },
    close(peer, details) {
      peers.delete(peer);
      console.info("[note-socket] close", {
        id: peer.id,
        code: details.code,
        peers: peers.size,
      });
      stopIfIdle();
    },
    error(peer, error) {
      console.error("[note-socket] error", { id: peer.id, error });
    },
  },
});

export default handler;
