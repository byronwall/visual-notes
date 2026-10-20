export type SocketStatus = "idle" | "connecting" | "open" | "closed" | "error";

type SocketClientOptions<TServer> = {
  path: string;
  /** Stable prefix for this socket's console logs, e.g. "job-socket". */
  logPrefix: string;
  parse: (value: unknown) => TServer | null;
  onMessage: (message: TServer) => void;
  onStatus?: (status: SocketStatus) => void;
  /** Close codes after which the client stops reconnecting. */
  stopOnCloseCodes?: number[];
  /**
   * For servers that greet on connect and send heartbeats: report "open"
   * only after the first message, and reconnect when none arrives in time
   * (counting from the connect attempt) or the socket goes quiet. This catches sockets that opened but are not
   * actually wired to the handler (a dev server's cold start, a stale proxy).
   */
  watchdog?: { firstMessageMs: number; idleMs: number };
};

export type SocketClient<TClient> = {
  connect: () => void;
  close: () => void;
  send: (message: TClient) => void;
};

const MAX_RECONNECT_DELAY_MS = 15000;
const BASE_RECONNECT_DELAY_MS = 500;
const RECONNECT_JITTER_MS = 300;
const WATCHDOG_CLOSE_CODE = 4000;

const isBrowser = () => typeof window !== "undefined";

const makeSocketUrl = (path: string) => {
  if (!isBrowser()) return path;
  const base = window.location.origin.replace(/^http/, "ws");
  return new URL(path, base).toString();
};

const nextDelay = (attempt: number) => {
  const jitter = Math.floor(Math.random() * RECONNECT_JITTER_MS);
  const delay = BASE_RECONNECT_DELAY_MS * 2 ** attempt + jitter;
  return Math.min(delay, MAX_RECONNECT_DELAY_MS);
};

/** A browser WebSocket that reconnects with capped, jittered backoff. */
export function createSocketClient<TServer, TClient = never>(
  options: SocketClientOptions<TServer>,
): SocketClient<TClient> {
  const prefix = `[${options.logPrefix}]`;
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let watchdogTimer: number | null = null;
  let reconnectAttempt = 0;
  let shouldReconnect = true;
  let lastUrl: string | null = null;

  const setStatus = (status: SocketStatus) => {
    options.onStatus?.(status);
  };

  const clearReconnectTimer = () => {
    if (!isBrowser() || reconnectTimer === null) return;
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const clearWatchdog = () => {
    if (!isBrowser() || watchdogTimer === null) return;
    window.clearTimeout(watchdogTimer);
    watchdogTimer = null;
  };

  const armWatchdog = (current: WebSocket, ms: number, reason: string) => {
    clearWatchdog();
    watchdogTimer = window.setTimeout(() => {
      if (socket !== current) return;
      console.warn(`${prefix} ${reason}; reconnecting`, { afterMs: ms });
      current.close(WATCHDOG_CLOSE_CODE, reason);
    }, ms);
  };

  const scheduleReconnect = () => {
    if (!isBrowser() || !shouldReconnect) return;
    clearReconnectTimer();
    const delay = nextDelay(reconnectAttempt);
    reconnectAttempt += 1;
    console.debug(`${prefix} reconnect scheduled`, {
      delayMs: delay,
      attempt: reconnectAttempt,
    });
    reconnectTimer = window.setTimeout(connect, delay);
  };

  function connect() {
    if (!isBrowser()) return;
    if (socket && socket.readyState !== WebSocket.CLOSED) return;
    shouldReconnect = true;
    clearReconnectTimer();
    setStatus("connecting");
    lastUrl = makeSocketUrl(options.path);
    const current = new WebSocket(lastUrl);
    const watchdog = options.watchdog;
    let greeted = false;
    socket = current;
    // Armed before "open" so a handshake that never completes is retried too.
    if (watchdog) armWatchdog(current, watchdog.firstMessageMs, "no greeting");

    const markOpen = () => {
      console.info(`${prefix} open`, { url: lastUrl });
      reconnectAttempt = 0;
      setStatus("open");
    };

    current.addEventListener("open", () => {
      if (!watchdog) markOpen();
    });
    current.addEventListener("message", (event: MessageEvent) => {
      if (watchdog) {
        if (!greeted) {
          greeted = true;
          markOpen();
        }
        armWatchdog(current, watchdog.idleMs, "socket went quiet");
      }
      if (typeof event.data !== "string") return;
      let raw: unknown;
      try {
        raw = JSON.parse(event.data);
      } catch (err) {
        console.error(`${prefix} parse error`, err);
        return;
      }
      const message = options.parse(raw);
      if (message) options.onMessage(message);
    });
    current.addEventListener("close", (event) => {
      console.debug(`${prefix} close`, {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      if (socket !== current) return;
      socket = null;
      clearWatchdog();
      if (options.stopOnCloseCodes?.includes(event.code)) {
        shouldReconnect = false;
        console.info(`${prefix} stopped by server`, { code: event.code });
        setStatus("idle");
        return;
      }
      setStatus("closed");
      scheduleReconnect();
    });
    current.addEventListener("error", () => {
      console.warn(`${prefix} error`, { url: lastUrl });
      if (socket === current) setStatus("error");
    });
  }

  const close = () => {
    shouldReconnect = false;
    clearReconnectTimer();
    clearWatchdog();
    const current = socket;
    socket = null;
    current?.close();
  };

  const send = (message: TClient) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(message));
  };

  return { connect, close, send };
}
