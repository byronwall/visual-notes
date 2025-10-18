import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";

// Returns a list of known docs for sync: originalContentId, contentHash, updatedAt
// Optional query: take (1..100), cursorUpdatedAt ISO to filter items updated since
export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const takeParam = url.searchParams.get("take");
  const sinceParam = url.searchParams.get("since");
  const take = Math.min(Math.max(Number(takeParam ?? "500"), 1), 1000);

  const where: any = { originalContentId: { not: null } };
  if (sinceParam) {
    const since = new Date(sinceParam);
    if (!isNaN(since.getTime())) {
      where.updatedAt = { gt: since };
    }
  }

  const items = await (prisma as any).doc.findMany({
    where,
    select: {
      originalContentId: true,
      contentHash: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "asc" },
    take,
  });

  return json({ items });
}
