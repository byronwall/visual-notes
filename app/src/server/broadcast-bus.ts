import { BroadcastChannel, isMainThread, threadId } from "node:worker_threads";

type Listener<T> = (payload: T) => void;

type BusEntry = {
  listeners: Set<Listener<unknown>>;
  channel: BroadcastChannel;
};

const REGISTRY_KEY = Symbol.for("visual-notes.broadcast-bus");

// Vinxi routers can load the same module more than once, so each named bus
// keeps one listener set and one channel per thread on globalThis.
const registry = (): Map<string, BusEntry> => {
  const holder = globalThis as typeof globalThis & {
    [REGISTRY_KEY]?: Map<string, BusEntry>;
  };
  holder[REGISTRY_KEY] ??= new Map();
  return holder[REGISTRY_KEY];
};

const deliver = (name: string, entry: BusEntry, payload: unknown) => {
  for (const listener of entry.listeners) {
    try {
      listener(payload);
    } catch (err) {
      console.error(`[broadcast-bus:${name}] listener failed`, err);
    }
  }
};

const entryFor = (name: string): BusEntry => {
  const map = registry();
  const existing = map.get(name);
  if (existing) return existing;

  const channel = new BroadcastChannel(name);
  // Never keep the process (or a test run) alive just for this channel.
  (channel as unknown as { unref?: () => void }).unref?.();
  const entry: BusEntry = { listeners: new Set(), channel };
  channel.onmessage = (event: unknown) => {
    deliver(name, entry, (event as { data: unknown }).data);
  };
  map.set(name, entry);
  return entry;
};

export type BroadcastBus<T> = {
  publish: (payload: T) => void;
  subscribe: (listener: Listener<T>) => () => void;
};

/**
 * In-process pub/sub that reaches every module instance in this thread and
 * every other thread in the process. A channel never hears its own posts, so
 * each listener receives a message exactly once.
 */
export function createBroadcastBus<T>(name: string): BroadcastBus<T> {
  return {
    publish(payload) {
      const entry = entryFor(name);
      deliver(name, entry, payload);
      entry.channel.postMessage(payload);
    },
    subscribe(listener) {
      const entry = entryFor(name);
      entry.listeners.add(listener as Listener<unknown>);
      console.debug(`[broadcast-bus:${name}] subscribe`, {
        pid: process.pid,
        thread: isMainThread ? "main" : threadId,
        listeners: entry.listeners.size,
      });
      return () => {
        entry.listeners.delete(listener as Listener<unknown>);
      };
    },
  };
}
