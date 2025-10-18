import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";
import { z } from "zod";
import { normalizeAiOutputToHtml } from "~/server/lib/markdown";

const ingestInput = z.object({
  title: z.string().min(1).max(200),
  markdown: z.string().min(1),
});

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();
    const input = ingestInput.parse(body);
    const html = normalizeAiOutputToHtml(input.markdown);
    const created = await (prisma as any).doc.create({
      data: { title: input.title, markdown: input.markdown, html },
      select: { id: true },
    });
    return json({ id: created.id }, { status: 201 });
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
