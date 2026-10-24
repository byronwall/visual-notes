import { z } from "zod";
import { describeActivityEvent } from "~/components/activity/activity-format";
import { listTimelineEvents } from "~/server/activity/activity-store";
import { prisma } from "~/server/db";
import type { ActionEventItem } from "~/services/activity/activity.types";
import { MCP_CALL_EVENT_PREFIX } from "./call-log";
import { appLink, limitArg, noteIdArg, parseSince } from "./shared";
import type { ToolRegistrar } from "./tool-registry";

// The Activity page's timeline, read-only: what changed recently, by whom.

export const ACTIVITY_INSTRUCTIONS =
  "activity_query answers 'what changed lately' across the app or for one note, including who did it (via is set for agents). To poll, pass the previous answer's pollSince as since, so no event comes back twice; when truncated, pass nextCursor for the next older page. Stay quiet when a poll returns nothing new.";

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
        "Activity events, newest first, as one-line summaries with ids. Defaults to the last 24 hours; filter by domain (doc = notes, time_block = time blocks, event = events and places, mcp = connector tool calls with outcome, duration, and the records each changed; left out unless asked for) or by noteId for one note's history. callId groups a tool call with the changes it made. truncated + nextCursor page back; pollSince is the since for the next poll.",
      input: {
        since: z.string().optional().describe("ISO date or date-time"),
        until: z
          .string()
          .optional()
          .describe("ISO date or date-time; only events at or before it"),
        cursor: z
          .string()
          .min(1)
          .optional()
          .describe("nextCursor from a truncated answer: the next older page"),
        domain: z.enum(DOMAINS).optional(),
        noteId: noteIdArg
          .optional()
          .describe("Only events about this note (pair with an early since)"),
        limit: limitArg(200, 50),
      },
    },
    async ({ since, until, cursor, domain, noteId, limit }) => {
      const from = parseSince(since, "since") ?? new Date(Date.now() - DAY_MS);
      const to = parseSince(until, "until");
      const take = limit ?? 50;
      const events = await listTimelineEvents({
        from: from.toISOString(),
        to: to?.toISOString(),
        cursor,
        eventDomain: domain,
        excludeDomains: ["mcp"],
        relatedDocId: noteId,
        take,
      });
      const changed = domain === "mcp" ? await changesByCall(events) : null;
      const truncated = events.length === take;
      const newest = events[0]?.createdAt;
      return {
        events: events.map((event) => {
          const d = describeActivityEvent(event);
          const href = d.docHref ?? d.href;
          return {
            id: event.id,
            at: event.createdAt,
            type: event.eventType,
            summary: [d.verb, d.docTitle && `“${d.docTitle}”`, d.detail]
              .filter(Boolean)
              .join(" "),
            via: d.via,
            noteId: event.relatedDocId,
            entityId: event.entityId,
            /** Same for a tool call and every change it made. */
            callId: event.requestId ?? null,
            ...(changed ? callDetails(event, changed) : {}),
            appUrl: href ? appLink(ctx, href) : null,
          };
        }),
        from: from.toISOString(),
        until: to?.toISOString() ?? null,
        truncated,
        nextCursor: truncated ? events[events.length - 1]!.id : null,
        // Strictly after the newest event, so the next poll starts fresh.
        pollSince: newest
          ? new Date(new Date(newest).getTime() + 1).toISOString()
          : (to ?? new Date()).toISOString(),
      };
    },
  );
}

type Change = { type: string; entityId: string | null; noteId: string | null };

/** The domain events each MCP call caused, keyed by call id. */
async function changesByCall(
  events: ActionEventItem[],
): Promise<Map<string, Change[]>> {
  const callIds = events
    .filter((e) => e.eventType.startsWith(MCP_CALL_EVENT_PREFIX) && e.requestId)
    .map((e) => e.requestId!);
  if (!callIds.length) return new Map();
  const rows = await prisma.actionEvent.findMany({
    where: {
      requestId: { in: callIds },
      NOT: { eventType: { startsWith: MCP_CALL_EVENT_PREFIX } },
    },
    orderBy: { createdAt: "asc" },
    select: {
      requestId: true,
      eventType: true,
      entityId: true,
      relatedDocId: true,
    },
  });
  const byCall = new Map<string, Change[]>();
  for (const row of rows) {
    const list = byCall.get(row.requestId!) ?? [];
    list.push({
      type: row.eventType,
      entityId: row.entityId,
      noteId: row.relatedDocId,
    });
    byCall.set(row.requestId!, list);
  }
  return byCall;
}

const MAX_CHANGES = 10;

/** Outcome, timing, and changed records of one MCP call event. */
function callDetails(event: ActionEventItem, changed: Map<string, Change[]>) {
  if (!event.eventType.startsWith(MCP_CALL_EVENT_PREFIX)) return {};
  const payload = event.payload ?? {};
  const changes = (event.requestId && changed.get(event.requestId)) || [];
  return {
    tool: event.entityId,
    outcome: event.eventType.slice(MCP_CALL_EVENT_PREFIX.length),
    durationMs:
      typeof payload.durationMs === "number" ? payload.durationMs : null,
    code: typeof payload.code === "string" ? payload.code : null,
    changed: changes.slice(0, MAX_CHANGES),
    ...(changes.length > MAX_CHANGES ? { changedTruncated: true } : {}),
  };
}
