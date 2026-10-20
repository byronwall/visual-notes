import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import {
  normalizeMarkdownToHtml,
  sanitizeHtmlContent,
} from "~/server/lib/markdown";

export type CreateNoteInput = {
  title: string;
  markdown?: string;
  html?: string;
  path?: string;
  meta?: Record<string, string | number | boolean | null>;
};

/** Creates a note from in-app input. Server-only. */
export async function createNoteRecord(input: CreateNoteInput) {
  const html = input.html
    ? sanitizeHtmlContent(String(input.html))
    : normalizeMarkdownToHtml(input.markdown ?? "");
  const markdown = input.html ? "" : (input.markdown ?? "");
  const path = input.path?.trim() ? input.path.trim() : null;
  const created = await prisma.doc.create({
    data: { title: input.title, markdown, html, path, meta: input.meta },
    select: { id: true },
  });
  await logActionEvent({
    eventType: "doc.create",
    entityType: "doc",
    entityId: created.id,
    relatedDocId: created.id,
    payload: {
      source: null,
      hasPath: Boolean(path),
      hasMeta: Boolean(input.meta && Object.keys(input.meta).length > 0),
    },
  });
  return { id: created.id };
}
