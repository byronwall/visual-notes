import { action, json } from "@solidjs/router";
import { z } from "zod";
import {
  feedEntryModeSchema,
  feedInputSchema,
  feedPatchSchema,
  type FeedInput,
  type FeedPatch,
} from "~/lib/events/feed-schemas";
import type { FeedEntryMode } from "~/lib/events/types";
import {
  createFeed,
  deleteFeed,
  rotateFeedToken,
  setFeedEntry,
  updateFeed,
} from "~/server/calendar/feed-store";
import {
  fetchEventFeeds,
  fetchFeedEntries,
  fetchFeedPreview,
  fetchFeeds,
} from "./feeds.queries";

const id = z.string().min(1);

// Feed edits refresh every feed read; there are only a handful of feeds.
const FEED_KEYS = [
  fetchFeeds.key,
  fetchFeedPreview.key,
  fetchFeedEntries.key,
  fetchEventFeeds.key,
];

export const createCalendarFeed = action(async (input: FeedInput) => {
  "use server";
  const feed = await createFeed(feedInputSchema.parse(input));
  return json(feed, { revalidate: FEED_KEYS });
}, "feeds-create");

export const saveCalendarFeed = action(
  async (payload: { id: string; patch: FeedPatch }) => {
    "use server";
    const feed = await updateFeed(
      id.parse(payload.id),
      feedPatchSchema.parse(payload.patch ?? {}),
    );
    return json(feed, { revalidate: FEED_KEYS });
  },
  "feeds-save",
);

export const removeCalendarFeed = action(async (feedId: string) => {
  "use server";
  await deleteFeed(id.parse(feedId));
  return json({ ok: true }, { revalidate: FEED_KEYS });
}, "feeds-remove");

export const rotateCalendarFeedToken = action(async (feedId: string) => {
  "use server";
  const feed = await rotateFeedToken(id.parse(feedId));
  return json(feed, { revalidate: FEED_KEYS });
}, "feeds-rotate-token");

/** `mode: null` clears the manual entry so only the rule applies. */
export const setCalendarFeedEntry = action(
  async (payload: {
    feedId: string;
    eventId: string;
    mode: FeedEntryMode | null;
  }) => {
    "use server";
    await setFeedEntry(
      id.parse(payload.feedId),
      id.parse(payload.eventId),
      feedEntryModeSchema.parse(payload.mode),
    );
    return json({ ok: true }, { revalidate: FEED_KEYS });
  },
  "feeds-set-entry",
);
