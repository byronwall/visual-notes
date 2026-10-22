import { AsyncLocalStorage } from "node:async_hooks";

// Ties every action event logged inside a unit of work (one MCP tool call) to
// that work's id, without each store having to thread it through.

type EventScope = {
  requestId: string;
  /** Who acted ("Claude"), stamped on each event's payload as `agent`. */
  agent?: string | null;
};

const scope = new AsyncLocalStorage<EventScope>();

export const runInEventScope = <T>(value: EventScope, fn: () => T): T =>
  scope.run(value, fn);

export const currentEventScope = (): EventScope | undefined => scope.getStore();
