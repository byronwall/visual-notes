import type { ArchivedPageListItem } from "~/services/archive/archive.types";

export const UNGROUPED_FILTER = "__ungrouped";

export type CapturedSincePreset = "24h" | "7d" | "30d" | "90d";

export const CAPTURED_SINCE_OPTIONS: Array<{ value: CapturedSincePreset | ""; label: string }> = [
  { value: "", label: "Any time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

const HOUR_MS = 60 * 60 * 1000;
const PRESET_HOURS: Record<CapturedSincePreset, number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  "90d": 24 * 90,
};

export function isCapturedSincePreset(value: string | undefined): value is CapturedSincePreset {
  return Boolean(value && value in PRESET_HOURS);
}

/**
 * Converts a preset into an ISO lower bound. Rounded to the hour so the server
 * render and the hydrated client build the same query key.
 */
export function capturedSinceToIso(preset: CapturedSincePreset, now = Date.now()) {
  const hourStart = Math.floor(now / HOUR_MS) * HOUR_MS;
  return new Date(hourStart - PRESET_HOURS[preset] * HOUR_MS).toISOString();
}

export function matchesArchiveSearch(item: ArchivedPageListItem, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [item.title, item.originalUrl, item.siteHostname, item.description, item.groupName]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return needle.split(/\s+/).every((token) => haystack.includes(token));
}

export function displayHostname(hostname: string | null | undefined, url: string) {
  const host = hostname || safeHostname(url);
  return host ? host.replace(/^www\./, "") : "";
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/** URL without protocol, for compact monospace display. */
export function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}
