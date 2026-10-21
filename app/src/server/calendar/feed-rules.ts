// Which events a feed's rule selects, and the shows it publishes.
//
// Rule: rows of `collectionId` (optionally only those matching `viewId`'s
// filter), limited to shows whose effective decision is in `decisions`.
// With no collection, a non-empty `decisions` set selects across every
// event; no collection and no decisions means a manual-only feed. Manual
// `include` entries add all of an event's shows; `exclude` entries drop them.
import { prisma } from "~/server/db";
import { matchesFilter, withTitle } from "~/lib/collections/query";
import type { CollectionRow } from "~/lib/collections/types";
import { instantToWallClock } from "~/lib/events/time";
import {
  DEFAULT_TIME_ZONE,
  type CalendarFeed,
  type OccurrenceListItem,
} from "~/lib/events/types";
import {
  ROW_SELECT,
  loadLiveProperties,
  mapRow,
  mapView,
} from "~/services/collections/collections.server";
import { listOccurrences } from "./event-store";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SHOWS = 2000;

export type RuleScope =
  | { kind: "none" }
  | { kind: "any" }
  | {
      kind: "collection";
      collectionId: string;
      matches: (row: CollectionRow) => boolean;
    };

type RuleFeed = Pick<
  CalendarFeed,
  "collectionId" | "viewId" | "decisions" | "pastDays" | "entries"
>;

/** Today in the default zone, so relative date filters are stable. */
export const feedToday = (now: Date) =>
  instantToWallClock(now, DEFAULT_TIME_ZONE).date;

export async function loadRuleScope(
  feed: RuleFeed,
  now: Date,
): Promise<RuleScope> {
  const view = feed.viewId
    ? await prisma.collectionView.findUnique({ where: { id: feed.viewId } })
    : null;
  const collectionId = feed.collectionId ?? view?.collectionId ?? null;
  if (!collectionId)
    return feed.decisions.length ? { kind: "any" } : { kind: "none" };
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, deletedAt: null },
    select: { id: true },
  });
  if (!collection) return { kind: "none" };
  const filter =
    view && view.collectionId === collectionId
      ? mapView(view).config.filter
      : undefined;
  const properties = await loadLiveProperties(collectionId);
  const propsById = new Map(withTitle(properties).map((p) => [p.id, p]));
  const today = feedToday(now);
  return {
    kind: "collection",
    collectionId,
    matches: (row) => matchesFilter(row, filter, propsById, today),
  };
}

/** Note ids the rule selects, or null for "any note". */
export async function ruleDocIds(scope: RuleScope): Promise<string[] | null> {
  if (scope.kind === "none") return [];
  if (scope.kind === "any") return null;
  const rows = await prisma.doc.findMany({
    where: { collectionId: scope.collectionId, event: { isNot: null } },
    select: ROW_SELECT,
  });
  return rows
    .map(mapRow)
    .filter(scope.matches)
    .map((r) => r.id);
}

/** First instant a feed keeps: `pastDays` before now. */
export const windowStart = (feed: Pick<CalendarFeed, "pastDays">, now: Date) =>
  new Date(now.getTime() - feed.pastDays * DAY_MS);

/** Every show the feed publishes, oldest first, cancelled shows included. */
export async function resolveFeedOccurrences(
  feed: RuleFeed,
  now: Date = new Date(),
): Promise<OccurrenceListItem[]> {
  const from = windowStart(feed, now).toISOString();
  const scope = await loadRuleScope(feed, now);
  const docIds = await ruleDocIds(scope);
  const ruled =
    docIds && docIds.length === 0
      ? []
      : await listOccurrences({
          from,
          includeCancelled: true,
          limit: MAX_SHOWS,
          ...(docIds ? { docIds } : {}),
          ...(feed.decisions.length ? { decisions: feed.decisions } : {}),
        });

  const includeIds = feed.entries
    .filter((e) => e.mode === "include")
    .map((e) => e.eventId);
  const excludeIds = new Set(
    feed.entries.filter((e) => e.mode === "exclude").map((e) => e.eventId),
  );
  const included = includeIds.length
    ? await listOccurrences({
        from,
        includeCancelled: true,
        limit: MAX_SHOWS,
        docIds: (
          await prisma.event.findMany({
            where: { id: { in: includeIds } },
            select: { docId: true },
          })
        ).map((e) => e.docId),
      })
    : [];

  const byId = new Map<string, OccurrenceListItem>();
  for (const show of [...ruled, ...included]) {
    if (!excludeIds.has(show.eventId)) byId.set(show.id, show);
  }
  return [...byId.values()].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  );
}
