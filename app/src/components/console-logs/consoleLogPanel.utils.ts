import { type ConsoleCaptureEntry } from "~/lib/console-log-capture";

export const parseBoundedInt = (
  raw: string,
  fallback: number,
  min: number,
  max: number,
) => {
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
};

export const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export const buildVisibleJson = (
  entries: ConsoleCaptureEntry[],
  prefixFilter: string,
  searchQuery: string,
) => {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      filter: prefixFilter,
      search: searchQuery.trim() || undefined,
      count: entries.length,
      logs: entries.map((entry) => ({
        id: entry.id,
        level: entry.level,
        timestamp: entry.timestamp,
        prefix: entry.prefix,
        details: {
          args: entry.args,
        },
      })),
    },
    null,
    2,
  );
};

export const buildSingleEntryJson = (entry: ConsoleCaptureEntry) => {
  return JSON.stringify(
    {
      id: entry.id,
      level: entry.level,
      timestamp: entry.timestamp,
      prefix: entry.prefix,
      details: {
        args: entry.args,
      },
    },
    null,
    2,
  );
};

export const buildPrefixesText = (rows: Array<[string, number]>, total: number) => {
  const lines = rows.map(([prefix, count]) =>
    prefix === "untyped" ? `[untyped] ${count}` : `[${prefix}] ${count}`,
  );
  return `Visible prefixes (${total} logs)\n${lines.join("\n")}`;
};

export const buildDownloadFilename = (prefixFilter: string) => {
  const date = new Date().toISOString().replaceAll(":", "-");
  const suffix = prefixFilter === "all" ? "all" : prefixFilter;
  return `visual-notes-logs-${suffix}-${date}.json`;
};
