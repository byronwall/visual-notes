import type { APIEvent } from "@solidjs/start/server";
import { buildIcs, feedFileSlug } from "~/lib/events/ics";
import {
  getFeedByToken,
  resolveFeedOccurrences,
} from "~/server/calendar/feed-store";

const LOG_PREFIX = "[cal-feed]";

const notFound = () =>
  new Response("Not found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });

/** Public iCal subscription: `/cal/<token>.ics`. The token is the secret. */
export async function GET(event: APIEvent) {
  const raw = String(event.params.token ?? "");
  const token = raw.endsWith(".ics") ? raw.slice(0, -4) : raw;
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return notFound();

  const startedAt = Date.now();
  try {
    const feed = await getFeedByToken(token);
    if (!feed) {
      console.info(`${LOG_PREFIX} unknown token`);
      return notFound();
    }
    const shows = await resolveFeedOccurrences(feed);
    const body = buildIcs(feed, shows);
    console.info(
      `${LOG_PREFIX} served feed ${feed.id} shows:${shows.length} ${Date.now() - startedAt}ms`,
    );
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "cache-control": "private, max-age=300",
        "content-disposition": `inline; filename="${feedFileSlug(feed.name)}.ics"`,
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} failed`, (error as Error).message);
    return new Response("Calendar unavailable", { status: 500 });
  }
}
