import type { RecentItem } from "./recents.types";

/**
 * Interleaves notes, collections, and research topics by their latest edit,
 * newest first, keeping one entry per entity.
 */
export function mergeRecentItems(items: RecentItem[], take: number): RecentItem[] {
  const latest = new Map<string, RecentItem>();
  for (const item of items) {
    const key = `${item.kind}:${item.id}`;
    const current = latest.get(key);
    if (!current || item.at > current.at) latest.set(key, item);
  }
  return [...latest.values()]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, take);
}
