import type { AppArea } from "~/lib/note-events";

/** The sidebar's Recent list: notes, collections, and research topics. */
const RECENT_KEY = "sidebar-recent-items";

/**
 * Query-key prefixes refreshed when notes change elsewhere. `revalidate`
 * matches by prefix, so these cover every `docs-*` list, path, preview, and
 * meta query, the `note-*` views (tags, backlinks, open tasks), the activity
 * timelines, a note's Versions list, and the sidebar's Recent list.
 */
export const NOTE_LIVE_QUERY_KEYS = [
  "docs-",
  "activity-",
  "note-",
  "doc-revisions",
  RECENT_KEY,
] as const;

/**
 * Query-key prefixes refreshed when an `app:changed` event names an area.
 * Tasks also refresh the open-tasks view, since note task lines read their
 * status from the task. Collections and research topics also show in Recent.
 */
export const APP_LIVE_QUERY_KEYS: Record<AppArea, readonly string[]> = {
  research: ["research-", RECENT_KEY],
  tasks: ["task-", "note-open-tasks"],
  collections: ["collections-", RECENT_KEY],
  "time-blocks": ["time-block"],
  archive: ["archive-"],
  events: ["events-"],
  inbox: ["annotations-", "inbox-"],
  pathways: ["pathway"],
};

/** Coalesces bursts (bulk moves, multi-step MCP writes) into one refresh. */
export const NOTE_LIVE_DEBOUNCE_MS = 250;

/**
 * The longest a refresh waits while events keep arriving. An agent that
 * writes a note every 200 ms would otherwise hold the debounce open, and
 * nothing would show until it stopped.
 */
export const NOTE_LIVE_MAX_WAIT_MS = 1_000;

/** A hidden tab longer than this catches up when it becomes visible again. */
export const NOTE_LIVE_STALE_AFTER_HIDDEN_MS = 5 * 60 * 1000;
