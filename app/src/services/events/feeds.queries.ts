import { query } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { prisma } from "~/server/db";
import type { OccurrenceListItem } from "~/lib/events/types";
import {
  feedsForEvent,
  getFeed,
  listFeedEntries,
  listFeeds,
  resolveFeedOccurrences,
} from "~/server/calendar/feed-store";

export const fetchFeeds = query(async () => {
  "use server";
  return listFeeds();
}, "feeds-list");

export type FeedPreview = {
  /** Next shows the feed publishes, soonest first. */
  upcoming: OccurrenceListItem[];
  upcomingCount: number;
  /** Past shows kept by `pastDays`. */
  pastCount: number;
};

export const fetchFeedPreview = query(
  async (input: { feedId: string; limit?: number }): Promise<FeedPreview> => {
    "use server";
    const feed = await getFeed(input.feedId);
    if (!feed) return { upcoming: [], upcomingCount: 0, pastCount: 0 };
    const now = new Date();
    const shows = await resolveFeedOccurrences(feed, now);
    const nowIso = now.toISOString();
    const upcoming = shows.filter((s) => (s.endsAt ?? s.startsAt) >= nowIso);
    return {
      upcoming: upcoming.slice(0, input.limit ?? 10),
      upcomingCount: upcoming.length,
      pastCount: shows.length - upcoming.length,
    };
  },
  "feeds-preview",
);

export const fetchFeedEntries = query(async (feedId: string) => {
  "use server";
  return listFeedEntries(feedId);
}, "feeds-entries");

/** Every feed with whether this event is in it (rule or manual). */
export const fetchEventFeeds = query(async (eventId: string) => {
  "use server";
  return feedsForEvent(eventId);
}, "feeds-for-event");

export type FeedRuleOption = {
  id: string;
  name: string;
  views: Array<{ id: string; name: string }>;
};

/** Collections and their page views, for the rule editor. */
export const fetchFeedRuleOptions = query(
  async (): Promise<FeedRuleOption[]> => {
    "use server";
    const rows = await prisma.collection.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        views: {
          where: { hostDocId: null },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: { id: true, name: true },
        },
      },
    });
    return rows;
  },
  "feeds-rule-options",
);

/** Origin the browser used, so subscribe URLs work behind proxies. */
export const fetchFeedOrigin = query(async () => {
  "use server";
  const request = getRequestEvent()?.request;
  if (!request) return "";
  const url = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    url.host;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "");
  return `${proto}://${host}`;
}, "feeds-origin");
