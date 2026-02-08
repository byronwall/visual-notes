import { type MetaRecord } from "~/services/docs.service";

export type MetaEntry = { key: string; value: string };

export const normalizeMetaRecord = (
  input: Record<string, unknown> | null | undefined
): MetaRecord => {
  if (!input || typeof input !== "object") return {};

  const out: MetaRecord = {};
  for (const [key, rawValue] of Object.entries(input)) {
    if (typeof rawValue === "string") {
      out[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "number") {
      out[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "boolean") {
      out[key] = rawValue;
      continue;
    }
    if (rawValue === null) {
      out[key] = null;
    }
  }
  return out;
};

export const serializeMetaRecord = (meta: MetaRecord) =>
  JSON.stringify(
    Object.entries(meta)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, value])
  );

export const entriesFromMeta = (meta?: MetaRecord | null): MetaEntry[] =>
  Object.entries(meta || {}).map(([key, value]) => ({ key, value: String(value) }));

export const recordFromEntries = (entries: MetaEntry[]): MetaRecord => {
  const record: MetaRecord = {};
  for (const entry of entries) {
    const key = entry.key.trim();
    if (!key) continue;
    record[key] = entry.value;
  }
  return record;
};

export const upsertEntry = (
  entries: MetaEntry[],
  index: number | null,
  nextEntry: MetaEntry
): MetaEntry[] => {
  const next = entries.slice();
  if (index === null) {
    next.push(nextEntry);
    return next;
  }
  next[index] = nextEntry;
  return next;
};

export const removeEntryAt = (entries: MetaEntry[], index: number): MetaEntry[] => {
  const next = entries.slice();
  next.splice(index, 1);
  return next;
};

export const summarizePath = (path: string) =>
  path.trim().length > 0 ? path : "Unfiled";

export const summarizeMeta = (meta: MetaRecord) => {
  const entries = Object.entries(meta).filter(([key]) => key.trim().length > 0);
  if (entries.length === 0) return "No details";

  return entries
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
};
