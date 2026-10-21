import { z } from "zod";
import * as archive from "~/server/archive/archive-store";
import { logActionEvent } from "~/server/events/action-events";
import {
  agentContext,
  appLink,
  ConnectorError,
  limitArg,
  parseSince,
  type ConnectorContext,
} from "./shared";
import type { ToolRegistrar } from "./tool-registry";

// The web archive (pages saved by the browser extension) over the connector.
// Agents can read pages and their notes and add a note to a page. Capturing,
// regrouping, editing or deleting pages and notes, and the archive canvas
// layout, stay with the user.

export const ARCHIVE_INSTRUCTIONS =
  "The web archive holds pages the user saved from the browser. archive_query finds pages, archive_get loads one with its notes (by url to check whether it was saved), and archive_add_note adds a note to a page.";

export const archivePageUrl = (ctx: ConnectorContext, id: string) =>
  appLink(ctx, `/archive?item=${encodeURIComponent(id)}`);

export function registerArchiveTools(tools: ToolRegistrar): void {
  const { ctx } = tools;
  const withAppUrl = <T extends { id: string }>(page: T) => ({
    ...page,
    appUrl: archivePageUrl(ctx, page.id),
  });

  tools.read(
    "archive_query",
    {
      title: "Query web archive",
      description:
        "Saved web pages, most recently captured first, filtered by words (title, url, or the page's notes), group, hostname, or capture date.",
      input: {
        query: z.string().optional(),
        group: z.string().optional(),
        hostname: z
          .string()
          .optional()
          .describe("Part of the site's hostname, e.g. github.com"),
        capturedAfter: z.string().optional().describe("ISO date or date-time"),
        limit: limitArg(100, 50),
      },
    },
    async (args) => {
      const capturedAfter =
        parseSince(args.capturedAfter, "capturedAfter") ?? undefined;
      const pages = await archive.searchArchivedPages({
        ...args,
        text: args.query,
        capturedAfter,
      });
      return { pages: pages.map(withAppUrl) };
    },
  );

  tools.read(
    "archive_get",
    {
      title: "Get archived page",
      description:
        "One saved page with all its notes and recent capture snippets, by id or by url. A url that was never saved returns archived: false.",
      input: {
        id: z.string().optional(),
        url: z.string().optional().describe("The page's web address"),
      },
    },
    async ({ id, url }) => {
      if (!id === !url)
        throw new ConnectorError("invalid", "Pass exactly one of id or url.");
      const pageId = id ?? (await archive.findArchivedPageByUrl(url!))?.id;
      if (!pageId) return { archived: false, url };
      const page = await archive.getArchivedPage(pageId);
      if (!page)
        throw new ConnectorError(
          "not_found",
          `No archived page ${pageId}. Use archive_query.`,
        );
      return { archived: true, ...withAppUrl(page) };
    },
  );

  tools.write(
    "archive_add_note",
    {
      title: "Add note to archived page",
      description:
        "Add a note (text, and optionally an image url) to a saved page.",
      input: {
        pageId: z.string().min(1).describe("The saved page's id"),
        text: z.string().min(1).max(2000),
        imageUrl: z.string().url().optional(),
      },
    },
    async ({ pageId, text, imageUrl }) => {
      const page = await archive.getArchivedPage(pageId);
      if (!page)
        throw new ConnectorError(
          "not_found",
          `No archived page ${pageId}. Use archive_query.`,
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
        context: agentContext(ctx),
      });
      return {
        id: created.id,
        pageId,
        text: text.trim(),
        createdAt: created.createdAt,
        appUrl: archivePageUrl(ctx, pageId),
      };
    },
  );
}
