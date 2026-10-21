import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { describeActivityEvent } from "~/components/activity/activity-format";
import { listTimelineEvents } from "~/server/activity/activity-store";
import { ConnectorError, type ConnectorContext } from "./notes-shared";

// The Activity page's timeline, read-only: what changed recently, by whom.

export const ACTIVITY_TOOL_SCOPES: Record<string, string> = {
  activity_recent: "notes:read",
};

export const ACTIVITY_INSTRUCTIONS =
  "activity_recent answers 'what changed lately' across notes, tasks, research, collections, the calendar, and the archive, with who did it (via is set for agents).";

const DOMAINS = [
  "doc",
  "task",
  "research",
  "collection",
  "time_block",
  "archive",
  "search",
  "ai",
  "admin",
] as const;

type Guarded = (
  ctx: ConnectorContext,
  tool: string,
  fn: () => Promise<unknown>,
) => Promise<CallToolResult>;

export function registerActivityTools(
  server: McpServer,
  ctx: ConnectorContext,
  guarded: Guarded,
): void {
  server.registerTool(
    "activity_recent",
    {
      title: "Recent activity",
      description:
        "Activity events, newest first, as one-line summaries. Defaults to the last 24 hours; filter by domain (doc = notes, time_block = calendar).",
      inputSchema: {
        since: z.string().optional().describe("ISO date or date-time"),
        domain: z.enum(DOMAINS).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    ({ since, domain, limit }) =>
      guarded(ctx, "activity_recent", async () => {
        const from = since
          ? new Date(since)
          : new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (Number.isNaN(from.getTime()))
          throw new ConnectorError("invalid", `since is not a date: ${since}`);
        const events = await listTimelineEvents({
          from: from.toISOString(),
          eventDomain: domain,
          take: limit ?? 50,
        });
        return events.map((event) => {
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
            url: href ? `${ctx.origin}${href}` : null,
          };
        });
      }),
  );
}
