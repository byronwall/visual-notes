import type { RecentKind } from "./recents.types";

export type RecentTouch = { kind: RecentKind; id: string; at: Date };

const VIEW_EVENT_KINDS: Record<string, RecentKind> = {
  "doc.view": "note",
  "doc.update": "note",
  "doc.create": "note",
  "collection.view": "collection",
  "research.view": "research",
  "tag.view": "tag",
  "path.view": "path",
};

export const RECENT_EVENT_TYPES = Object.keys(VIEW_EVENT_KINDS);

export const recentKindForEvent = (eventType: string): RecentKind | undefined =>
  VIEW_EVENT_KINDS[eventType];

export const recentKey = (kind: RecentKind, id: string) => `${kind}:${id}`;

/**
 * Collapses touches (visits, edits, `updatedAt`) to one per entity at its
 * latest time, newest first.
 */
export function mergeRecentTouches(touches: RecentTouch[]): RecentTouch[] {
  const latest = new Map<string, RecentTouch>();
  for (const touch of touches) {
    const key = recentKey(touch.kind, touch.id);
    const current = latest.get(key);
    if (!current || touch.at > current.at) latest.set(key, touch);
  }
  return [...latest.values()].sort((a, b) => b.at.getTime() - a.at.getTime());
}
