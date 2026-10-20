/**
 * Query-key prefixes refreshed when notes change elsewhere. `revalidate`
 * matches by prefix, so these cover every `docs-*` list, path, preview, and
 * meta query plus the activity timelines behind "recently changed" views.
 */
export const NOTE_LIVE_QUERY_KEYS = ["docs-", "activity-"] as const;

/** Coalesces bursts (bulk moves, multi-step MCP writes) into one refresh. */
export const NOTE_LIVE_DEBOUNCE_MS = 250;

/** A hidden tab longer than this catches up when it becomes visible again. */
export const NOTE_LIVE_STALE_AFTER_HIDDEN_MS = 5 * 60 * 1000;
