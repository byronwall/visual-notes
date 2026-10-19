import { normalizeDotPath } from "~/utils/path-links";

export type PathCount = { path: string; notes: number; total: number };

export function normalizeNotePath(
  input: string | null | undefined,
): string | null {
  return normalizeDotPath(input ?? "") || null;
}

export function pathExists(existing: Iterable<string>, path: string): boolean {
  for (const candidate of existing) {
    if (candidate === path || candidate.startsWith(`${path}.`)) return true;
  }
  return false;
}

/**
 * Expands per-path note counts into a tree listing where every ancestor
 * appears with its own notes and the total beneath it.
 */
export function buildPathTree(
  rows: { path: string; count: number }[],
  prefix?: string | null,
): PathCount[] {
  const byPath = new Map<string, PathCount>();
  const normalizedPrefix = normalizeNotePath(prefix);
  for (const row of rows) {
    const segments = row.path.split(".");
    for (let i = 1; i <= segments.length; i += 1) {
      const path = segments.slice(0, i).join(".");
      const entry = byPath.get(path) ?? { path, notes: 0, total: 0 };
      entry.total += row.count;
      if (i === segments.length) entry.notes += row.count;
      byPath.set(path, entry);
    }
  }
  return Array.from(byPath.values())
    .filter(
      (entry) =>
        !normalizedPrefix ||
        entry.path === normalizedPrefix ||
        entry.path.startsWith(`${normalizedPrefix}.`),
    )
    .sort((a, b) => a.path.localeCompare(b.path));
}
