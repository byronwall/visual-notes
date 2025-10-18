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
