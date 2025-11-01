import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { createHash } from "crypto";
import { z } from "zod";
import { prisma } from "~/server/db";
import { sanitizeHtmlContent } from "~/server/lib/markdown";

const jsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const ingestInput = z
  .object({
    title: z.string().min(1).max(200),
    markdown: z.string().min(1).optional(),
    html: z.string().min(1).optional(),
    originalSource: z.string().min(1).max(128).optional(),
    originalContentId: z.string().min(1).max(512).optional(),
    contentHash: z.string().min(16).max(128).optional(),
    path: z.string().min(1).max(512).optional(),
    meta: z.record(jsonPrimitive).optional(),
  })
  .refine((v) => Boolean(v.markdown || v.html), {
    message: "markdown or html is required",
    path: ["markdown"],
  });

function computeSha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();
    const input = ingestInput.parse(body);

    // html is preferred - if it's used, we don't want to populate markdown
    const usingHtml = Boolean(input.html);
    const usingMarkdown = !usingHtml && Boolean(input.markdown);

    // if html is used, we want to sanitize it
    const html = usingHtml ? sanitizeHtmlContent(String(input.html)) : "";
    const markdown = usingMarkdown ? input.markdown! : "";

    // NOTE: from here down, do not refer to input.html or input.markdown - only use html and markdown

    const contentHash = input.contentHash
      ? input.contentHash
      : computeSha256Hex(usingMarkdown ? markdown : html);

    if (input.originalContentId) {
      // If an item with the same (originalSource, originalContentId) exists and content is unchanged, return a non-success code
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
          // Duplicate unchanged
          return json(
            { error: "Duplicate unchanged", id: existing.id },
            { status: 409 }
          );
        }
        const updated = await prisma.doc.update({
          where: { id: existing.id },
          data: {
            title: input.title,
            markdown,
            html,
            contentHash,
            path: input.path,
            meta: input.meta,
          },
          select: { id: true },
        });
        return json({ id: updated.id }, { status: 200 });
      }
      const created = await prisma.doc.create({
        data: {
          title: input.title,
          markdown,
          html,
          originalSource: input.originalSource,
          originalContentId: input.originalContentId,
          contentHash,
          path: input.path,
          meta: input.meta,
        },
        select: { id: true },
      });
      return json({ id: created.id }, { status: 201 });
    } else {
      const created = await prisma.doc.create({
        data: {
          title: input.title,
          markdown,
          html,
          contentHash,
          path: input.path,
          meta: input.meta,
        },
        select: { id: true },
      });
      return json({ id: created.id }, { status: 201 });
    }
  } catch (e) {
    const msg = (e as Error).message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const takeParam = url.searchParams.get("take");
  const pathPrefix = url.searchParams.get("pathPrefix") || undefined;
  const metaKey = url.searchParams.get("metaKey") || undefined;
  const metaValueRaw = url.searchParams.get("metaValue");
  // Treat all values as strings for now to keep UI simple
  const metaValue = metaValueRaw ?? undefined;
  const take = Number(takeParam ?? "50");
  const where: any = {};
  if (pathPrefix) where.path = { startsWith: pathPrefix };
  if (metaKey && metaValue !== undefined) {
    where.meta = { path: [metaKey], equals: metaValue } as any;
  } else if (metaKey && metaValue === undefined) {
    // If only a key is provided, match any non-null value for that key
    where.meta = { path: [metaKey], not: null } as any;
  }
  const items = await prisma.doc.findMany({
    orderBy: { updatedAt: "desc" },
    where,
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      path: true,
    },
    take,
  });
  return json({ items });
}

export async function DELETE(_event: APIEvent) {
  try {
    // Use transaction to ensure consistency if future related tables exist
    await prisma.$transaction([prisma.doc.deleteMany({})]);
    return json({ ok: true });
  } catch (e) {
    const msg = (e as Error).message || "Failed to delete";
    return json({ error: msg }, { status: 500 });
  }
}
