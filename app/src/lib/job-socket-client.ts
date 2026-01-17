import type {
  JobSocketClientMessage,
  JobSocketServerMessage,
} from "./job-socket-messages";

export type JobSocketStatus =
  | "idle"
  | "connecting"
  | "open"
  | "closed"
  | "error";

type JobSocketClientOptions = {
  path: string;
  onMessage: (message: JobSocketServerMessage) => void;
  onStatus?: (status: JobSocketStatus) => void;
};

export type JobSocketClient = {
  connect: () => void;
  close: () => void;
  send: (message: JobSocketClientMessage) => void;
};

const MAX_RECONNECT_DELAY_MS = 15000;
const BASE_RECONNECT_DELAY_MS = 500;
const RECONNECT_JITTER_MS = 300;

const isBrowser = () => typeof window !== "undefined";

const makeSocketUrl = (path: string) => {
  if (!isBrowser()) return path;
  const base = window.location.origin.replace(/^http/, "ws");
  return new URL(path, base).toString();
};

const parseMessage = (raw: string): JobSocketServerMessage | null => {
  try {
    const parsed = JSON.parse(raw) as JobSocketServerMessage;
    if (parsed.type === "jobs:init" || parsed.type === "jobs:update") {
      return parsed;
    }
    return null;
  } catch (err) {
    console.error("job-socket:parse:error", err);
    return null;
  }
};

const nextDelay = (attempt: number) => {
  const jitter = Math.floor(Math.random() * RECONNECT_JITTER_MS);
  const delay = BASE_RECONNECT_DELAY_MS * 2 ** attempt + jitter;
  return Math.min(delay, MAX_RECONNECT_DELAY_MS);
};

export function createJobSocketClient(
  options: JobSocketClientOptions
): JobSocketClient {
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let reconnectAttempt = 0;
  let shouldReconnect = true;
  let lastUrl: string | null = null;

  const setStatus = (status: JobSocketStatus) => {
    options.onStatus?.(status);
  };

  const clearReconnectTimer = () => {
    if (!isBrowser()) return;
    if (reconnectTimer === null) return;
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const scheduleReconnect = () => {
    if (!isBrowser() || !shouldReconnect) return;
    clearReconnectTimer();
    const delay = nextDelay(reconnectAttempt);
    reconnectAttempt += 1;
    console.log("job-socket:reconnect:scheduled", {
      delayMs: delay,
      attempt: reconnectAttempt,
      url: lastUrl,
    });
    reconnectTimer = window.setTimeout(() => {
      connect();
    }, delay);
  };

  const handleOpen = () => {
    console.log("job-socket:open", { url: lastUrl });
    reconnectAttempt = 0;
    setStatus("open");
  };

  const handleClose = (event: CloseEvent) => {
    console.warn("job-socket:close", {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      url: lastUrl,
    });
    setStatus("closed");
    scheduleReconnect();
  };

  const handleError = (event: Event) => {
    console.error("job-socket:error", { event, url: lastUrl });
    setStatus("error");
  };

  const handleMessage = (event: MessageEvent) => {
    if (typeof event.data !== "string") return;
    const message = parseMessage(event.data);
    if (!message) return;
    options.onMessage(message);
  };

  const connect = () => {
    if (!isBrowser()) return;
    if (socket && socket.readyState !== WebSocket.CLOSED) return;
    clearReconnectTimer();
    setStatus("connecting");
    lastUrl = makeSocketUrl(options.path);
    console.log("job-socket:connect", {
      url: lastUrl,
      attempt: reconnectAttempt + 1,
    });
    socket = new WebSocket(lastUrl);
    socket.addEventListener("open", handleOpen);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", handleError);
    socket.addEventListener("message", handleMessage);
  };

  const close = () => {
    shouldReconnect = false;
    clearReconnectTimer();
    if (!socket) return;
    socket.close();
    socket = null;
  };

  const send = (message: JobSocketClientMessage) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(message));
  };

  return { connect, close, send };
}
