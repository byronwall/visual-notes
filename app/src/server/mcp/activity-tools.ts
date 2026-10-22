import { z } from "zod";
import { describeActivityEvent } from "~/components/activity/activity-format";
import { listTimelineEvents } from "~/server/activity/activity-store";
import { appLink, limitArg, noteIdArg, parseSince } from "./shared";
import type { ToolRegistrar } from "./tool-registry";

// The Activity page's timeline, read-only: what changed recently, by whom.

export const ACTIVITY_INSTRUCTIONS =
  "activity_query answers 'what changed lately' across the app or for one note, including who did it (via is set for agents).";

const DOMAINS = [
  "doc",
  "task",
  "research",
  "collection",
  "time_block",
  "event",
  "archive",
  "search",
  "ai",
  "admin",
  "mcp",
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function registerActivityTools(tools: ToolRegistrar): void {
  const { ctx } = tools;

  tools.read(
    "activity_query",
    {
      title: "Query activity",
      description:
        "Activity events, newest first, as one-line summaries. Defaults to the last 24 hours; filter by domain (doc = notes, time_block = time blocks, event = events and places, mcp = connector tool calls, left out unless asked for) or by noteId for one note's history.",
      input: {
        since: z.string().optional().describe("ISO date or date-time"),
        domain: z.enum(DOMAINS).optional(),
        noteId: noteIdArg
          .optional()
          .describe("Only events about this note (pair with an early since)"),
        limit: limitArg(200, 50),
      },
    },
    async ({ since, domain, noteId, limit }) => {
      const from = parseSince(since, "since") ?? new Date(Date.now() - DAY_MS);
      const events = await listTimelineEvents({
        from: from.toISOString(),
        eventDomain: domain,
        excludeDomains: ["mcp"],
        relatedDocId: noteId,
        take: limit ?? 50,
      });
      return {
        events: events.map((event) => {
          const d = describeActivityEvent(event);
          const href = d.docHref ?? d.href;
          return {
            at: event.createdAt,
            type: event.eventType,
            summary: [d.verb, d.docTitle && `“${d.docTitle}”`, d.detail]
              .filter(Boolean)
              .join(" "),
            via: d.via,
            noteId: event.relatedDocId,
            entityId: event.entityId,
            appUrl: href ? appLink(ctx, href) : null,
          };
        }),
      };
    },
  );
}
