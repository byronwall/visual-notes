import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { prisma } from "~/server/db";
import {
  normalizeMarkdownToHtml,
  sanitizeHtmlContent,
} from "~/server/lib/markdown";

function getIdFromNotionId(id: string) {
  let initialId = decodeURIComponent(id.slice("__NOTION__".length));

  // if it ends with `.md`, remove it
  if (initialId.endsWith(".md")) {
    initialId = initialId.slice(0, -3);
  }

  return initialId;
}

export async function GET(event: APIEvent) {
  const id = event.params?.id as string;

  if (!id) return json({ error: "Missing id" }, { status: 400 });
  // Support special Notion links that encode originalContentId with a __NOTION__ prefix
  const isNotionId = id.startsWith("__NOTION__");

  const resolvedDoc = isNotionId
    ? await prisma.doc.findFirst({
        where: {
          originalContentId: getIdFromNotionId(id),
        },
      })
    : await prisma.doc.findUnique({
        where: { id },
      });
  const doc = resolvedDoc;
  if (!doc) return json({ error: "Not found" }, { status: 404 });
  try {
    const html = String(doc.html || "");
    const imgCount = (html.match(/<img\b/gi) || []).length;
    const dataImgCount = (html.match(/<img[^>]*src=["']data:/gi) || []).length;
    console.log(
      "[api.docs.get] doc:%s html len:%d imgs:%d dataImgs:%d",
      doc.id,
      html.length,
      imgCount,
      dataImgCount
    );
  } catch {}
  return json({ ...doc });
}

const jsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const putInput = z.object({
  title: z.string().min(1).max(200).optional(),
  markdown: z.string().min(1).optional(),
  html: z.string().min(1).optional(),
  // Allow empty string to clear path
  path: z.string().max(512).optional(),
  meta: z.record(jsonPrimitive).optional(),
});

export async function PUT(event: APIEvent) {
  const id = event.params?.id as string;
  if (!id) return json({ error: "Missing id" }, { status: 400 });
  try {
    const body = await event.request.json();
    const input = putInput.parse(body);
    const updates: Record<string, any> = {};

    if (input.title !== undefined) updates.title = input.title;

    if (input.markdown) {
      // Source of truth as markdown → regenerate sanitized HTML
      const html = normalizeMarkdownToHtml(input.markdown);
      updates.markdown = input.markdown;
      updates.html = html;
    } else if (input.html) {
      // Accept raw HTML edits → sanitize before saving; keep prior markdown unchanged
      const sanitized = sanitizeHtmlContent(String(input.html));
      try {
        const beforeImgs = (String(input.html).match(/<img\b/gi) || []).length;
        const beforeDataImgs = (
          String(input.html).match(/<img[^>]*src=["']data:/gi) || []
        ).length;
        const afterImgs = (sanitized.match(/<img\b/gi) || []).length;
        const afterDataImgs = (
          sanitized.match(/<img[^>]*src=["']data:/gi) || []
        ).length;
        console.log(
          "[api.docs.put] doc:%s imgs:%d→%d dataImgs:%d→%d",
          id,
          beforeImgs,
          afterImgs,
          beforeDataImgs,
          afterDataImgs
        );
      } catch {}
      updates.html = sanitized;
    }

    if (input.path !== undefined)
      updates.path = input.path.trim().length ? input.path.trim() : null;
    if (input.meta !== undefined) updates.meta = input.meta;

    if (Object.keys(updates).length === 0) {
      return json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.doc.update({
      where: { id },
      data: updates,
      select: { id: true, updatedAt: true },
    });
    return json(updated, { status: 200 });
  } catch (e) {
    const msg = (e as Error).message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(event: APIEvent) {
  const id = event.params?.id as string;
  if (!id) return json({ error: "Missing id" }, { status: 400 });
  try {
    console.log("[api.docs.delete] deleting doc:%s", id);
    // Rely on ON DELETE CASCADE relations to clean up dependent rows
    const deleted = await prisma.doc
      .delete({ where: { id }, select: { id: true } })
      .catch(() => null);
    if (!deleted) return json({ error: "Not found" }, { status: 404 });
    return json({ ok: true, id: deleted.id });
  } catch (e) {
    const msg = (e as Error).message || "Failed to delete";
    return json({ error: msg }, { status: 500 });
  }
}
