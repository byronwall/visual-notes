import { action } from "@solidjs/router";
import { createHash } from "crypto";
import { z } from "zod";
import { prisma } from "~/server/db";
import {
  normalizeMarkdownToHtml,
  sanitizeHtmlContent,
} from "~/server/lib/markdown";

const jsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const ingestInput = z
  .object({
    title: z.string().min(1).max(200),
    markdown: z.string().min(1).optional(),
    html: z.string().min(1).optional(),
    originalSource: z.string().min(1).max(128).optional(),
    originalContentId: z.string().min(1).max(512).optional(),
    contentHash: z.string().min(16).max(128).optional(),
    path: z.string().max(512).optional(),
    meta: z.record(jsonPrimitive).optional(),
  })
  .refine((v) => Boolean(v.markdown || v.html), {
    message: "markdown or html is required",
    path: ["markdown"],
  });

const updateInput = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  markdown: z.string().min(1).optional(),
  html: z.string().min(1).optional(),
  path: z.string().max(512).optional(),
  meta: z.record(jsonPrimitive).optional(),
});

function computeSha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export const createDoc = action(
  async (payload: z.infer<typeof ingestInput>) => {
    "use server";
    const input = ingestInput.parse(payload);

    const usingHtml = Boolean(input.html);
    const usingMarkdown = !usingHtml && Boolean(input.markdown);

    const html = usingHtml ? sanitizeHtmlContent(String(input.html)) : "";
    const markdown = usingMarkdown ? input.markdown! : "";

    const contentHash = input.contentHash
      ? input.contentHash
      : computeSha256Hex(usingMarkdown ? markdown : html);

    if (input.originalContentId) {
      const existing = input.originalSource
        ? await prisma.doc.findUnique({
            where: {
              originalSource_originalContentId: {
                originalSource: input.originalSource,
                originalContentId: input.originalContentId,
              },
            },
            select: { id: true, contentHash: true },
          })
        : await prisma.doc.findFirst({
            where: {
              originalContentId: input.originalContentId,
              originalSource: null,
            },
            select: { id: true, contentHash: true },
          });
      if (existing) {
        if (existing.contentHash && existing.contentHash === contentHash) {
          throw new Error("Duplicate unchanged");
        }
        const updated = await prisma.doc.update({
          where: { id: existing.id },
          data: {
            title: input.title,
            markdown,
            html,
            contentHash,
            path: input.path?.trim()?.length ? input.path.trim() : null,
            meta: input.meta,
          },
          select: { id: true },
        });
        return { id: updated.id, updated: true };
      }
      const created = await prisma.doc.create({
        data: {
          title: input.title,
          markdown,
          html,
          originalSource: input.originalSource,
          originalContentId: input.originalContentId,
          contentHash,
          path: input.path?.trim()?.length ? input.path.trim() : null,
          meta: input.meta,
        },
        select: { id: true },
      });
      return { id: created.id };
    }

    const created = await prisma.doc.create({
      data: {
        title: input.title,
        markdown,
        html,
        contentHash,
        path: input.path?.trim()?.length ? input.path.trim() : null,
        meta: input.meta,
      },
      select: { id: true },
    });
    return { id: created.id };
  },
  "docs-create"
);

export const updateDoc = action(
  async (payload: z.infer<typeof updateInput>) => {
    "use server";
    const input = updateInput.parse(payload);
    const updates: Record<string, any> = {};

    if (input.title !== undefined) updates.title = input.title;

    if (input.markdown) {
      const html = normalizeMarkdownToHtml(input.markdown);
      updates.markdown = input.markdown;
      updates.html = html;
    } else if (input.html) {
      const sanitized = sanitizeHtmlContent(String(input.html));
      try {
        const beforeImgs = (String(input.html).match(/<img\b/gi) || []).length;
        const beforeDataImgs = (
          String(input.html).match(/<img[^>]*src=["']data:/gi) || []
        ).length;
        const afterImgs = (sanitized.match(/<img\b/gi) || []).length;
        const afterDataImgs =
          (sanitized.match(/<img[^>]*src=["']data:/gi) || []).length;
        console.log(
          "[docs.update] doc:%s imgs:%d->%d dataImgs:%d->%d",
          input.id,
          beforeImgs,
          afterImgs,
          beforeDataImgs,
          afterDataImgs
        );
      } catch {}
      updates.html = sanitized;
    }

    if (input.path !== undefined) {
      updates.path = input.path.trim().length ? input.path.trim() : null;
    }
    if (input.meta !== undefined) updates.meta = input.meta;

    if (Object.keys(updates).length === 0) {
      throw new Error("No valid fields to update");
    }

    const updated = await prisma.doc.update({
      where: { id: input.id },
      data: updates,
      select: { id: true, updatedAt: true },
    });
    return { id: updated.id, updatedAt: updated.updatedAt.toISOString() };
  },
  "docs-update"
);

export const deleteDoc = action(async (id: string) => {
  "use server";
  if (!id) throw new Error("Missing id");
  console.log("[docs.delete] deleting doc:%s", id);
  const deleted = await prisma.doc
    .delete({ where: { id }, select: { id: true } })
    .catch(() => null);
  if (!deleted) throw new Error("Not found");
  return { ok: true, id: deleted.id };
}, "docs-delete");
