// Calendar feed persistence. Plain async functions so server actions, the
// iCal route, and MCP tools share one implementation.
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import {
  feedInputSchema,
  type FeedInput,
  type FeedPatch,
} from "~/lib/events/feed-schemas";
import {
  effectiveDecision,
  type CalendarFeed,
  type FeedEntryMode,
} from "~/lib/events/types";
import { mapRow } from "~/services/collections/collections.server";
import { loadRuleScope } from "./feed-rules";

export { resolveFeedOccurrences } from "./feed-rules";

const LOG_PREFIX = "[feed-store]";

const FEED_INCLUDE = {
  entries: { select: { eventId: true, mode: true } },
} satisfies Prisma.CalendarFeedInclude;

type FeedRecord = Prisma.CalendarFeedGetPayload<{
  include: typeof FEED_INCLUDE;
}>;

export const mapFeed = (f: FeedRecord): CalendarFeed => ({
  id: f.id,
  name: f.name,
  description: f.description,
  token: f.token,
  collectionId: f.collectionId,
  viewId: f.viewId,
  decisions: f.decisions,
  pastDays: f.pastDays,
  entries: f.entries.map((e) => ({ eventId: e.eventId, mode: e.mode })),
  createdAt: f.createdAt.toISOString(),
  updatedAt: f.updatedAt.toISOString(),
});

/** 43-char URL-safe secret (32 random bytes). */
export const newFeedToken = () => randomBytes(32).toString("base64url");

const blankToNull = (value: string | null | undefined) =>
  value === undefined ? undefined : value?.trim() || null;

export async function listFeeds(): Promise<CalendarFeed[]> {
  const rows = await prisma.calendarFeed.findMany({
    where: { deletedAt: null },
    include: FEED_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapFeed);
}

export async function getFeed(id: string): Promise<CalendarFeed | null> {
  const row = await prisma.calendarFeed.findFirst({
    where: { id, deletedAt: null },
    include: FEED_INCLUDE,
  });
  return row ? mapFeed(row) : null;
}

export async function getFeedByToken(
  token: string,
): Promise<CalendarFeed | null> {
  if (!token) return null;
  const row = await prisma.calendarFeed.findFirst({
    where: { token, deletedAt: null },
    include: FEED_INCLUDE,
  });
  return row ? mapFeed(row) : null;
}

/** A view implies its collection; changing the collection drops the view. */
async function ruleData(patch: FeedPatch) {
  const data: Prisma.CalendarFeedUncheckedUpdateInput = {};
  if (patch.collectionId !== undefined) data.collectionId = patch.collectionId;
  if (patch.viewId !== undefined) {
    data.viewId = patch.viewId;
    if (patch.viewId) {
      const view = await prisma.collectionView.findUnique({
        where: { id: patch.viewId },
        select: { collectionId: true },
      });
      if (!view) throw new Error("View not found");
      data.collectionId = view.collectionId;
    }
  } else if (patch.collectionId !== undefined) {
    data.viewId = null;
  }
  return data;
}

export async function createFeed(input: FeedInput): Promise<CalendarFeed> {
  const parsed = feedInputSchema.parse(input);
  const rule = await ruleData(parsed);
  const row = await prisma.calendarFeed.create({
    data: {
      name: parsed.name,
      description: blankToNull(parsed.description) ?? null,
      token: newFeedToken(),
      collectionId: (rule.collectionId as string | null) ?? null,
      viewId: (rule.viewId as string | null) ?? null,
      decisions: parsed.decisions ?? [],
      pastDays: parsed.pastDays ?? 90,
    },
    include: FEED_INCLUDE,
  });
  console.info(`${LOG_PREFIX} created feed ${row.id}`);
  return mapFeed(row);
}

export async function updateFeed(
  id: string,
  patch: FeedPatch,
): Promise<CalendarFeed> {
  const data: Prisma.CalendarFeedUncheckedUpdateInput = {
    ...(await ruleData(patch)),
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.description !== undefined
      ? { description: blankToNull(patch.description) }
      : {}),
    ...(patch.decisions !== undefined ? { decisions: patch.decisions } : {}),
    ...(patch.pastDays !== undefined ? { pastDays: patch.pastDays } : {}),
  };
  const row = await prisma.calendarFeed.update({
    where: { id, deletedAt: null },
    data,
    include: FEED_INCLUDE,
  });
  return mapFeed(row);
}

/** Soft delete; the URL stops working immediately. */
export async function deleteFeed(id: string) {
  await prisma.calendarFeed.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  console.info(`${LOG_PREFIX} deleted feed ${id}`);
}

/** New secret; the old subscribe URL 404s from now on. */
export async function rotateFeedToken(id: string): Promise<CalendarFeed> {
  const row = await prisma.calendarFeed.update({
    where: { id, deletedAt: null },
    data: { token: newFeedToken() },
    include: FEED_INCLUDE,
  });
  console.info(`${LOG_PREFIX} rotated token for feed ${id}`);
  return mapFeed(row);
}

/** Includes or excludes one event by hand; `null` falls back to the rule. */
export async function setFeedEntry(
  feedId: string,
  eventId: string,
  mode: FeedEntryMode | null,
) {
  if (mode === null) {
    await prisma.calendarFeedEntry.deleteMany({ where: { feedId, eventId } });
  } else {
    await prisma.calendarFeedEntry.upsert({
      where: { feedId_eventId: { feedId, eventId } },
      create: { feedId, eventId, mode },
      update: { mode },
    });
  }
  await prisma.calendarFeed.update({
    where: { id: feedId },
    data: { updatedAt: new Date() },
  });
}

export type FeedMembership = {
  feed: Pick<CalendarFeed, "id" | "name" | "description">;
  /** The feed's rule selects this event. */
  byRule: boolean;
  /** Manual override, if any. */
  mode: FeedEntryMode | null;
  /** Final answer: rule or include, and not excluded. */
  inFeed: boolean;
};

/** Every feed with whether `eventId` is in it, for the note panel. */
export async function feedsForEvent(
  eventId: string,
  now: Date = new Date(),
): Promise<FeedMembership[]> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      decision: true,
      occurrences: { select: { decision: true } },
      doc: {
        select: {
          id: true,
          title: true,
          properties: true,
          collectionRank: true,
          createdAt: true,
          updatedAt: true,
          collectionId: true,
        },
      },
    },
  });
  if (!event) throw new Error("Event not found");
  const row = mapRow(event.doc);
  const decisions = new Set(
    event.occurrences.length
      ? event.occurrences.map((o) =>
          effectiveDecision(o.decision, event.decision),
        )
      : [event.decision],
  );
  const feeds = await listFeeds();
  return Promise.all(
    feeds.map(async (feed): Promise<FeedMembership> => {
      const scope = await loadRuleScope(feed, now);
      const decisionOk =
        feed.decisions.length === 0 ||
        feed.decisions.some((d) => decisions.has(d));
      const byRule =
        scope.kind === "none"
          ? false
          : scope.kind === "any"
            ? decisionOk
            : event.doc.collectionId === scope.collectionId &&
              scope.matches(row) &&
              decisionOk;
      const mode =
        feed.entries.find((e) => e.eventId === eventId)?.mode ?? null;
      return {
        feed: { id: feed.id, name: feed.name, description: feed.description },
        byRule,
        mode,
        inFeed: mode === "include" || (byRule && mode !== "exclude"),
      };
    }),
  );
}

export type FeedEntryDetail = {
  eventId: string;
  docId: string;
  title: string;
  mode: FeedEntryMode;
};

/** A feed's manual entries with their note titles, newest first. */
export async function listFeedEntries(
  feedId: string,
): Promise<FeedEntryDetail[]> {
  const rows = await prisma.calendarFeedEntry.findMany({
    where: { feedId },
    select: {
      eventId: true,
      mode: true,
      event: { select: { docId: true, doc: { select: { title: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    eventId: r.eventId,
    docId: r.event.docId,
    title: r.event.doc.title,
    mode: r.mode,
  }));
}
