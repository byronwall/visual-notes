import { action } from "@solidjs/router";
import { createHash } from "crypto";
import { z } from "zod";
import { prisma } from "~/server/db";
import {
  lengthDeltaBucket,
  logActionEvent,
  logDocUpdate,
} from "~/server/events/action-events";
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
        await logDocUpdate(
          updated.id,
          ["title", "markdown", "html", "path", "meta"],
          {
            source: input.originalSource ?? null,
            contentLengthDeltaBucket: "upsert_replace",
          },
        );
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
      await logActionEvent({
        eventType: "doc.create",
        entityType: "doc",
        entityId: created.id,
        relatedDocId: created.id,
        payload: {
          source: input.originalSource ?? null,
          hasPath: Boolean(input.path?.trim()),
          hasMeta: Boolean(input.meta && Object.keys(input.meta).length > 0),
        },
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
    await logActionEvent({
      eventType: "doc.create",
      entityType: "doc",
      entityId: created.id,
      relatedDocId: created.id,
      payload: {
        source: null,
        hasPath: Boolean(input.path?.trim()),
        hasMeta: Boolean(input.meta && Object.keys(input.meta).length > 0),
      },
    });
    return { id: created.id };
  },
  "docs-create",
);

export const updateDoc = action(
  async (payload: z.infer<typeof updateInput>) => {
    "use server";
    const input = updateInput.parse(payload);
    const updates: Record<string, any> = {};
    const fieldsChanged: string[] = [];
    let prevContentLength = 0;
    let nextContentLength = 0;
    let docBefore:
      | {
          html: string;
          markdown: string;
        }
      | undefined;

    if (input.html !== undefined || input.markdown !== undefined) {
      const existing = await prisma.doc.findUnique({
        where: { id: input.id },
        select: { html: true, markdown: true },
      });
      if (!existing) throw new Error("Not found");
      docBefore = {
        html: String(existing.html || ""),
        markdown: String(existing.markdown || ""),
      };
      prevContentLength = docBefore.html.length + docBefore.markdown.length;
    }

    if (input.title !== undefined) {
      updates.title = input.title;
      fieldsChanged.push("title");
    }

    if (input.markdown) {
      const html = normalizeMarkdownToHtml(input.markdown);
      updates.markdown = input.markdown;
      updates.html = html;
      fieldsChanged.push("markdown", "html");
      nextContentLength = html.length + input.markdown.length;
    } else if (input.html) {
      const sanitized = sanitizeHtmlContent(String(input.html));
      updates.html = sanitized;
      fieldsChanged.push("html");
      nextContentLength =
        sanitized.length + (docBefore ? docBefore.markdown.length : 0);
    }

    if (input.path !== undefined) {
      updates.path = input.path.trim().length ? input.path.trim() : null;
      fieldsChanged.push("path");
    }
    if (input.meta !== undefined) {
      updates.meta = input.meta;
      fieldsChanged.push("meta");
    }

    if (Object.keys(updates).length === 0) {
      throw new Error("No valid fields to update");
    }

    const updated = await prisma.doc.update({
      where: { id: input.id },
      data: updates,
      select: { id: true, updatedAt: true },
    });

    if (input.html !== undefined || input.markdown !== undefined) {
      if (nextContentLength <= 0 && docBefore) {
        nextContentLength =
          (docBefore.html || "").length + (docBefore.markdown || "").length;
      }
    }
    await logDocUpdate(updated.id, Array.from(new Set(fieldsChanged)), {
      hasContentChange:
        input.html !== undefined || input.markdown !== undefined,
      contentLengthDeltaBucket:
        input.html !== undefined || input.markdown !== undefined
          ? lengthDeltaBucket(prevContentLength, nextContentLength)
          : "not_applicable",
    });
    return { id: updated.id, updatedAt: updated.updatedAt.toISOString() };
  },
  "docs-update",
);

export const deleteDoc = action(async (id: string) => {
  "use server";
  if (!id) throw new Error("Missing id");
  const deleted = await prisma.doc
    .delete({ where: { id }, select: { id: true } })
    .catch(() => null);
  if (!deleted) throw new Error("Not found");
  await logActionEvent({
    eventType: "doc.delete",
    entityType: "doc",
    entityId: id,
    relatedDocId: id,
  });
  return { ok: true, id: deleted.id };
}, "docs-delete");
