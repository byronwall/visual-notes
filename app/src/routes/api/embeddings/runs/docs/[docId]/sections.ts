import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";
import { z } from "zod";

const paramsSchema = z.object({
  docId: z.string().min(1),
  runId: z.string().min(1).optional(),
});

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const runId = url.searchParams.get("runId") || undefined;
  const docId = event.params?.docId || url.pathname.split("/").slice(-2, -1)[0];
  const parsed = paramsSchema.safeParse({ docId, runId });
  if (!parsed.success)
    return json({ error: "Invalid params" }, { status: 400 });

  // Fetch sections and optionally annotate which ones are embedded for the given run
  const sections = await prisma.docSection.findMany({
    where: { docId: parsed.data.docId },
    select: {
      id: true,
      headingPath: true,
      orderIndex: true,
      charCount: true,
      text: true,
    },
    orderBy: { orderIndex: "asc" },
  });

  if (!runId) {
    return json({
      items: sections.map((s) => ({
        id: s.id,
        headingPath: s.headingPath,
        orderIndex: s.orderIndex,
        charCount: s.charCount,
        preview: s.text.slice(0, 280),
      })),
    });
  }

  const embedded = await prisma.docSectionEmbedding.findMany({
    where: { docId: parsed.data.docId, runId },
    select: { sectionId: true },
  });
  const embeddedIds = new Set(embedded.map((e) => e.sectionId));

  return json({
    items: sections.map((s) => ({
      id: s.id,
      headingPath: s.headingPath,
      orderIndex: s.orderIndex,
      charCount: s.charCount,
      preview: s.text.slice(0, 280),
      embedded: embeddedIds.has(s.id),
    })),
  });
}
