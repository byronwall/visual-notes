import { updatedBucket } from "../utils/grouping";
import type {
  DocsFacets,
  DocsFilters,
  DocsSummary,
  FacetCount,
  MetaRecord,
} from "./docs.types";

export type FacetRow = {
  path: string | null;
  source: string | null;
  collectionId: string | null;
  /** The row's collection set `showRowsInRecent`. */
  collectionOptedIn: boolean;
  updatedAtMs: number;
  activityClass: string | null;
  meta: MetaRecord | null;
};

type Collection = { id: string; name: string; icon: string | null };

export const UPDATED_WINDOWS = [1, 7, 30];
const DAY_MS = 24 * 60 * 60 * 1000;
// Lists stay readable and the payload stays small on a note base with many
// paths or meta values; the rail shows the top of each list.
const MAX_FACET_VALUES = 40;

const bump = (counts: Map<string, number>, key: string) =>
  counts.set(key, (counts.get(key) ?? 0) + 1);

const top = (counts: Map<string, number>): FacetCount[] =>
  [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, MAX_FACET_VALUES);

/** Mirrors `buildDocsWhere` for the filters that have a facet. */
const dimensions = (f: DocsFilters, nowMs: number) => ({
  collection: (r: FacetRow) => {
    if (f.collectionId) return r.collectionId === f.collectionId;
    if (f.collectionRows === "only") return !!r.collectionId;
    if (f.collectionRows === "all") return true;
    return !r.collectionId || r.collectionOptedIn;
  },
  path: (r: FacetRow) => {
    if (f.pathBlankOnly) return !r.path;
    if (!f.pathPrefix) return true;
    return r.path === f.pathPrefix || !!r.path?.startsWith(`${f.pathPrefix}.`);
  },
  source: (r: FacetRow) => !f.source || r.source === f.source,
  activity: (r: FacetRow) =>
    !f.activityClass || r.activityClass === f.activityClass,
  meta: (r: FacetRow) => {
    if (!f.metaKey) return true;
    const value = r.meta?.[f.metaKey];
    if (f.metaValue !== undefined) return value === f.metaValue;
    return value !== null && value !== undefined;
  },
  updated: (r: FacetRow) =>
    !f.updatedWithinDays ||
    nowMs - r.updatedAtMs <= f.updatedWithinDays * DAY_MS,
});

type Dimension = keyof ReturnType<typeof dimensions>;

/**
 * One pass over the rows. A facet ignores its own selection, so picking a
 * path leaves its siblings and their counts in place. A row missing exactly
 * one filter therefore still counts toward that filter's facet.
 */
export function computeFacets(
  rows: FacetRow[],
  f: DocsFilters,
  collections: Collection[],
  nowMs: number,
): Pick<DocsSummary, "total" | "bucketCounts" | "facets"> {
  const checks = Object.entries(dimensions(f, nowMs)) as [
    Dimension,
    (r: FacetRow) => boolean,
  ][];
  const prefix = f.pathPrefix ? `${f.pathPrefix}.` : "";

  let total = 0;
  let blankPaths = 0;
  let hiddenCollectionRows = 0;
  const bucketCounts: Record<string, number> = {};
  const paths = new Map<string, number>();
  const sources = new Map<string, number>();
  const activity = new Map<string, number>();
  const metaKeys = new Map<string, number>();
  const metaValues = new Map<string, number>();
  const collectionCounts = new Map<string, number>();
  const updated = new Map(UPDATED_WINDOWS.map((days) => [days, 0]));

  for (const r of rows) {
    let failed: Dimension | undefined;
    let failures = 0;
    for (const [name, check] of checks) {
      if (check(r)) continue;
      failed = name;
      failures += 1;
      if (failures > 1) break;
    }
    if (failures > 1) continue;
    const counts = (d: Dimension) => failures === 0 || failed === d;

    if (failures === 0) {
      total += 1;
      const { key } = updatedBucket(r.updatedAtMs, nowMs);
      bucketCounts[key] = (bucketCounts[key] ?? 0) + 1;
    }
    if (counts("path")) {
      if (!r.path) blankPaths += 1;
      else if (!prefix) bump(paths, r.path.split(".")[0]);
      else if (r.path.startsWith(prefix)) {
        const segment = r.path.slice(prefix.length).split(".")[0];
        bump(paths, `${prefix}${segment}`);
      }
    }
    if (counts("source") && r.source) bump(sources, r.source);
    if (counts("activity") && r.activityClass) bump(activity, r.activityClass);
    if (counts("meta") && r.meta) {
      for (const [key, value] of Object.entries(r.meta)) {
        if (value === null) continue;
        bump(metaKeys, key);
        if (key === f.metaKey && typeof value === "string")
          bump(metaValues, value);
      }
    }
    if (counts("collection") && r.collectionId) {
      bump(collectionCounts, r.collectionId);
      if (!r.collectionOptedIn) hiddenCollectionRows += 1;
    }
    if (counts("updated")) {
      for (const days of UPDATED_WINDOWS) {
        if (nowMs - r.updatedAtMs <= days * DAY_MS)
          updated.set(days, updated.get(days)! + 1);
      }
    }
  }

  const facets: DocsFacets = {
    paths: top(paths),
    blankPaths: prefix ? 0 : blankPaths,
    sources: top(sources),
    activity: top(activity),
    metaKeys: top(metaKeys),
    metaValues: top(metaValues),
    collections: collections
      .flatMap((c) => {
        const count = collectionCounts.get(c.id);
        return count
          ? [{ value: c.id, count, name: c.name, icon: c.icon }]
          : [];
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    updated: UPDATED_WINDOWS.map((days) => ({
      days,
      count: updated.get(days)!,
    })),
    hiddenCollectionRows,
  };
  return { total, bucketCounts, facets };
}
