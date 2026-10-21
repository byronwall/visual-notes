import type {
  UmapIslandItem,
  UmapRegionItem,
} from "~/features/umap/region-types";
import {
  ONE_WEEK_MS,
  formatRelativeTime,
} from "~/features/docs-index/utils/time";

export type RegionSort = "map" | "size" | "recent";

export type RegionActivity = {
  /** Newest `updatedAt` among the region's notes. */
  lastUpdatedAt: string | null;
  changedThisWeek: number;
};

export type RegionGroup = {
  id: string;
  /** Island title; null for the flat Size and Recent lists. */
  title: string | null;
  docCount: number;
  regions: UmapRegionItem[];
};

type Point = { x: number; y: number };

/** Rows of the map, top to bottom; three bands keep neighbors on one "line". */
const READING_BANDS = 3;

/**
 * Orders items the way you read the map: top band first, left to right within
 * a band. Coordinates are canvas space, so y grows downward.
 */
export function mapReadingOrder<T>(items: T[], point: (item: T) => Point): T[] {
  if (items.length < 2) return items.slice();
  const ys = items.map((item) => point(item).y);
  const minY = Math.min(...ys);
  const band = (Math.max(...ys) - minY) / READING_BANDS || 1;
  const bandOf = (item: T) =>
    Math.min(READING_BANDS - 1, Math.floor((point(item).y - minY) / band));
  return items
    .slice()
    .sort((a, b) => bandOf(a) - bandOf(b) || point(a).x - point(b).x);
}

export function regionActivity(
  docIds: string[],
  updatedAtById: Map<string, string>,
  now: number,
): RegionActivity {
  let lastUpdatedAt: string | null = null;
  let changedThisWeek = 0;
  for (const id of docIds) {
    const updatedAt = updatedAtById.get(id);
    if (!updatedAt) continue;
    if (!lastUpdatedAt || updatedAt > lastUpdatedAt) lastUpdatedAt = updatedAt;
    if (now - Date.parse(updatedAt) < ONE_WEEK_MS) changedThisWeek += 1;
  }
  return { lastUpdatedAt, changedThisWeek };
}

/** "Edited 2d ago · 5 this week", or null when no note timestamps are known. */
export function formatRegionActivity(activity: RegionActivity | undefined) {
  if (!activity?.lastUpdatedAt) return null;
  const edited = `Edited ${formatRelativeTime(activity.lastUpdatedAt)}`;
  return activity.changedThisWeek > 0
    ? `${edited} · ${activity.changedThisWeek} this week`
    : edited;
}

const byTitle = (a: UmapRegionItem, b: UmapRegionItem) =>
  a.title.localeCompare(b.title);

export function groupRegions(
  regions: UmapRegionItem[],
  islands: UmapIslandItem[],
  sort: RegionSort,
  activityById: Map<string, RegionActivity>,
): RegionGroup[] {
  if (sort !== "map") {
    const lastUpdated = (region: UmapRegionItem) =>
      activityById.get(region.id)?.lastUpdatedAt ?? "";
    const sorted = regions
      .slice()
      .sort((a, b) =>
        sort === "size"
          ? b.docCount - a.docCount || byTitle(a, b)
          : lastUpdated(b).localeCompare(lastUpdated(a)) || byTitle(a, b),
      );
    const docCount = regions.reduce((sum, region) => sum + region.docCount, 0);
    return [{ id: "all", title: null, docCount, regions: sorted }];
  }

  const byIsland = new Map<string, UmapRegionItem[]>();
  for (const region of regions) {
    const list = byIsland.get(region.islandId) ?? [];
    list.push(region);
    byIsland.set(region.islandId, list);
  }
  const knownIslands = mapReadingOrder(
    islands.filter((island) => byIsland.has(island.id)),
    (island) => island.centroid,
  );
  const groups: RegionGroup[] = knownIslands.map((island) => {
    const members = byIsland.get(island.id) ?? [];
    byIsland.delete(island.id);
    return {
      id: island.id,
      title: island.title,
      docCount: members.reduce((sum, region) => sum + region.docCount, 0),
      regions: mapReadingOrder(members, (region) => region.centroid),
    };
  });
  // Regions whose island is missing from the snapshot still need a home.
  const orphans = [...byIsland.values()].flat();
  if (orphans.length > 0) {
    groups.push({
      id: "other",
      title: "Other",
      docCount: orphans.reduce((sum, region) => sum + region.docCount, 0),
      regions: mapReadingOrder(orphans, (region) => region.centroid),
    });
  }
  return groups;
}
