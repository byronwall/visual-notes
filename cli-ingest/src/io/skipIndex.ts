import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type NoteExternalId = string;
export type NoteUpdatedAt = string; // ISO

export type SkipIndex = Record<NoteExternalId, NoteUpdatedAt>;

export function loadSkipIndex(path: string): SkipIndex {
  if (!path || !existsSync(path)) return {};
  try {
    const json = JSON.parse(readFileSync(path, "utf8"));
    if (Array.isArray(json)) {
      const out: SkipIndex = {};
      for (const it of json)
        if (it?.id && it?.updatedAt) out[it.id] = it.updatedAt;
      return out;
    }
    return json && typeof json === "object" ? (json as SkipIndex) : {};
  } catch {
    return {};
  }
}

export function mergeSkipIndex(
  base: SkipIndex,
  notes: { id: string; updatedAt: string }[]
): SkipIndex {
  const out = { ...base };
  for (const n of notes) {
    const prev = out[n.id];
    const nextMs = Date.parse(n.updatedAt);
    const prevMs = prev ? Date.parse(prev) : NaN;
    if (!Number.isNaN(nextMs) && (Number.isNaN(prevMs) || nextMs > prevMs))
      out[n.id] = n.updatedAt;
  }
  return out;
}

export function saveSkipIndex(path: string, idx: SkipIndex) {
  writeFileSync(path, JSON.stringify(idx, null, 2));
}
