import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";
import { z } from "zod";
import { normalizeAiOutputToHtml } from "~/server/lib/markdown";
import { createHash } from "crypto";

const ingestInput = z.object({
  title: z.string().min(1).max(200),
  markdown: z.string().min(1),
  originalContentId: z.string().min(1).max(512).optional(),
  contentHash: z.string().min(16).max(128).optional(),
});

function computeSha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();
    const input = ingestInput.parse(body);
    const html = normalizeAiOutputToHtml(input.markdown);
    const contentHash = input.contentHash ?? computeSha256Hex(input.markdown);

    if (input.originalContentId) {
      const upserted = await (prisma as any).doc.upsert({
        where: { originalContentId: input.originalContentId },
        create: {
          title: input.title,
          markdown: input.markdown,
          html,
          originalContentId: input.originalContentId,
          contentHash,
        },
        update: {
          title: input.title,
          markdown: input.markdown,
          html,
          contentHash,
        },
        select: { id: true },
      });
      return json({ id: upserted.id }, { status: 201 });
    } else {
      const created = await (prisma as any).doc.create({
        data: {
          title: input.title,
          markdown: input.markdown,
          html,
          contentHash,
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
  const take = Math.min(Math.max(Number(takeParam ?? "50"), 1), 100);
  const items = await (prisma as any).doc.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, createdAt: true },
    take,
  });
  return json({ items });
}

export async function DELETE(_event: APIEvent) {
  try {
    // Use transaction to ensure consistency if future related tables exist
    await (prisma as any).$transaction([(prisma as any).doc.deleteMany({})]);
    return json({ ok: true });
  } catch (e) {
    const msg = (e as Error).message || "Failed to delete";
    return json({ error: msg }, { status: 500 });
  }
}
