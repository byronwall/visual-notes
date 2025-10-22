import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";

// Returns a list of known docs for sync: originalContentId, contentHash, updatedAt
// Optional query: take (1..100), cursorUpdatedAt ISO to filter items updated since
export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const sinceParam = url.searchParams.get("since");
  const sourceParam = url.searchParams.get("source");

  const where: any = { originalContentId: { not: null } };
  if (sourceParam) {
    where.originalSource = sourceParam;
  }
  if (sinceParam) {
    const since = new Date(sinceParam);
    if (!isNaN(since.getTime())) {
      where.updatedAt = { gt: since };
    }
  }

  const items = await prisma.doc.findMany({
    where,
    select: {
      originalSource: true,
      originalContentId: true,
      contentHash: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "asc" },
  });

  return json({ items });
}
