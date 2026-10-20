import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSocketClient, type SocketStatus } from "./socket-client";

type Listener = (event: unknown) => void;

class FakeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances: FakeSocket[] = [];
  readyState = FakeSocket.CONNECTING;
  closedWith: number | undefined;
  private listeners = new Map<string, Listener[]>();

  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  emit(type: string, event: unknown = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.emit("open");
  }
  message(data: unknown) {
    this.emit("message", { data: JSON.stringify(data) });
  }
  close(code = 1000) {
    this.closedWith = code;
    this.readyState = FakeSocket.CLOSED;
    this.emit("close", { code, reason: "", wasClean: true });
  }
  send() {}
}

const latest = () => FakeSocket.instances[FakeSocket.instances.length - 1];

const makeClient = (
  extra: Partial<Parameters<typeof createSocketClient>[0]> = {},
) => {
  const statuses: SocketStatus[] = [];
  const messages: unknown[] = [];
  const client = createSocketClient<unknown>({
    path: "/ws/test",
    logPrefix: "socket-test",
    parse: (value) => value,
    onMessage: (message) => messages.push(message),
    onStatus: (status) => statuses.push(status),
    ...extra,
  });
  return { client, statuses, messages };
};

describe("createSocketClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("window", {
      location: { origin: "http://localhost:3000" },
      setTimeout,
      clearTimeout,
    });
    vi.stubGlobal("WebSocket", FakeSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reconnects with backoff after a close", () => {
    const { client, statuses } = makeClient();
    client.connect();
    expect(latest().url).toBe("ws://localhost:3000/ws/test");
    latest().open();
    expect(statuses).toEqual(["connecting", "open"]);
    latest().close(1006);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("stops reconnecting on a stop code", () => {
    const { client, statuses } = makeClient({ stopOnCloseCodes: [4503] });
    client.connect();
    latest().open();
    latest().close(4503);
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(statuses.at(-1)).toBe("idle");
  });

  describe("watchdog", () => {
    const watchdog = { firstMessageMs: 5_000, idleMs: 60_000 };

    it("reports open only after the first message", () => {
      const { client, statuses, messages } = makeClient({ watchdog });
      client.connect();
      latest().open();
      expect(statuses).toEqual(["connecting"]);
      latest().message({ type: "hello" });
      expect(statuses).toEqual(["connecting", "open"]);
      expect(messages).toEqual([{ type: "hello" }]);
    });

    it("retries a socket that opens but never greets", () => {
      const { client } = makeClient({ watchdog });
      client.connect();
      latest().open();
      vi.advanceTimersByTime(5_000);
      expect(FakeSocket.instances[0].closedWith).toBe(4000);
      vi.advanceTimersByTime(1_000);
      expect(FakeSocket.instances).toHaveLength(2);
    });

    it("retries a handshake that never completes", () => {
      const { client } = makeClient({ watchdog });
      client.connect();
      vi.advanceTimersByTime(5_000);
      expect(FakeSocket.instances[0].closedWith).toBe(4000);
    });

    it("retries a socket that goes quiet, and heartbeats keep it alive", () => {
      const { client } = makeClient({ watchdog });
      client.connect();
      latest().open();
      latest().message({ type: "ping" });
      vi.advanceTimersByTime(50_000);
      latest().message({ type: "ping" });
      vi.advanceTimersByTime(50_000);
      expect(FakeSocket.instances[0].closedWith).toBeUndefined();
      vi.advanceTimersByTime(10_000);
      expect(FakeSocket.instances[0].closedWith).toBe(4000);
    });

    it("stops all timers on close()", () => {
      const { client } = makeClient({ watchdog });
      client.connect();
      client.close();
      vi.advanceTimersByTime(120_000);
      expect(FakeSocket.instances).toHaveLength(1);
    });
  });
});
