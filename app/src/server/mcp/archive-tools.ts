import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as archive from "~/server/archive/archive-store";
import { logActionEvent } from "~/server/events/action-events";
import { ConnectorError, type ConnectorContext } from "./notes-shared";

// The web archive (pages saved by the browser extension) over the connector.
// Agents can read pages and their notes and add a note to a page. Capturing,
// regrouping, editing or deleting pages and notes, and the archive canvas
// layout, stay with the user.

export const ARCHIVE_TOOL_SCOPES: Record<string, string> = {
  archive_search: "notes:read",
  archive_get: "notes:read",
  archive_add_note: "notes:write",
};

export const ARCHIVE_INSTRUCTIONS =
  "The web archive holds pages the user saved from the browser, each with their own notes. archive_search finds pages by words in the title, url, or notes; archive_get loads one page (by id, or by url to check whether it was saved) with its notes; archive_add_note adds a note to a saved page.";

type Guarded = (
  ctx: ConnectorContext,
  tool: string,
  fn: () => Promise<unknown>,
) => Promise<CallToolResult>;

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;
const write = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
} as const;

export const archivePageUrl = (ctx: ConnectorContext, id: string) =>
  `${ctx.origin}/archive?item=${encodeURIComponent(id)}`;

export function registerArchiveTools(
  server: McpServer,
  ctx: ConnectorContext,
  guarded: Guarded,
): void {
  const withAppUrl = <T extends { id: string }>(page: T) => ({
    ...page,
    appUrl: archivePageUrl(ctx, page.id),
  });

  server.registerTool(
    "archive_search",
    {
      title: "Search web archive",
      description:
        "Saved web pages, most recently captured first, filtered by words (title, url, or the page's notes), group, hostname, or capture date.",
      inputSchema: {
        query: z.string().optional(),
        group: z.string().optional(),
        hostname: z
          .string()
          .optional()
          .describe("Part of the site's hostname, e.g. github.com"),
        capturedAfter: z.string().optional().describe("ISO date"),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: readOnly,
    },
    (args) =>
      guarded(ctx, "archive_search", async () => {
        const capturedAfter = args.capturedAfter
          ? new Date(args.capturedAfter)
          : undefined;
        if (capturedAfter && Number.isNaN(capturedAfter.getTime())) {
          throw new ConnectorError(
            "invalid",
            `capturedAfter is not a date: ${args.capturedAfter}`,
          );
        }
        const pages = await archive.searchArchivedPages({
          ...args,
          text: args.query,
          capturedAfter,
        });
        return pages.map(withAppUrl);
      }),
  );

  server.registerTool(
    "archive_get",
    {
      title: "Get archived page",
      description:
        "One saved page with all its notes and recent capture snippets, by id or by url. A url that was never saved returns archived: false.",
      inputSchema: {
        id: z.string().optional(),
        url: z.string().optional().describe("The page's web address"),
      },
      annotations: readOnly,
    },
    ({ id, url }) =>
      guarded(ctx, "archive_get", async () => {
        if (!id === !url)
          throw new ConnectorError("invalid", "Pass exactly one of id or url.");
        const pageId = id ?? (await archive.findArchivedPageByUrl(url!))?.id;
        if (!pageId) return { archived: false, url };
        const page = await archive.getArchivedPage(pageId);
        if (!page)
          throw new ConnectorError(
            "not_found",
            `No archived page ${pageId}. Use archive_search.`,
          );
        return { archived: true, ...withAppUrl(page) };
      }),
  );

  server.registerTool(
    "archive_add_note",
    {
      title: "Add note to archived page",
      description:
        "Add a note (text, and optionally an image url) to a saved page.",
      inputSchema: {
        pageId: z.string().min(1),
        text: z.string().min(1).max(2000),
        imageUrl: z.string().url().optional(),
      },
      annotations: write,
    },
    ({ pageId, text, imageUrl }) =>
      guarded(ctx, "archive_add_note", async () => {
        const page = await archive.getArchivedPage(pageId);
        if (!page)
          throw new ConnectorError(
            "not_found",
            `No archived page ${pageId}. Use archive_search.`,
          );
        const created = await archive.addArchivedPageNote({
          pageId,
          noteText: text,
          imageUrl,
        });
        await logActionEvent({
          eventType: "archive.note_added",
          entityType: "archived_page",
          entityId: pageId,
          payload: { pageTitle: page.title, noteId: created.id },
          context: { actorId: ctx.actorId, actorType: "chatgpt" },
        });
        return {
          id: created.id,
          pageId,
          text: text.trim(),
          createdAt: created.createdAt,
          appUrl: archivePageUrl(ctx, pageId),
        };
      }),
  );
}
