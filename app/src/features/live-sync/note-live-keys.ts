import type { AppArea } from "~/lib/note-events";

/**
 * Query-key prefixes refreshed when notes change elsewhere. `revalidate`
 * matches by prefix, so these cover every `docs-*` list, path, preview, and
 * meta query plus the activity timelines behind "recently changed" views.
 */
export const NOTE_LIVE_QUERY_KEYS = ["docs-", "activity-", "note-"] as const;

/**
 * Query-key prefixes refreshed when an `app:changed` event names an area.
 * Tasks also refresh the open-tasks view, since note task lines read their
 * status from the task.
 */
export const APP_LIVE_QUERY_KEYS: Record<AppArea, readonly string[]> = {
  research: ["research-"],
  tasks: ["task-", "note-open-tasks"],
  collections: ["collections-"],
  "time-blocks": ["time-block"],
};

/** Coalesces bursts (bulk moves, multi-step MCP writes) into one refresh. */
export const NOTE_LIVE_DEBOUNCE_MS = 250;

/** A hidden tab longer than this catches up when it becomes visible again. */
export const NOTE_LIVE_STALE_AFTER_HIDDEN_MS = 5 * 60 * 1000;
