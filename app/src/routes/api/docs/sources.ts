import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";

type SourceCount = { originalSource: string; count: number };

export async function GET(_event: APIEvent) {
  // Group by originalSource (excluding null) and return counts + total
  const [total, groups] = await Promise.all([
    prisma.doc.count({}),
    prisma.doc.groupBy({
      by: ["originalSource"],
      _count: { _all: true },
      where: { originalSource: { not: null } },
    }),
  ]);

  const sources: SourceCount[] = groups
    .filter((g) => typeof g.originalSource === "string")
    .map((g) => ({
      originalSource: g.originalSource as string,
      // Prisma types don't narrow _count shape strongly here; assert minimal shape
      count: (g as unknown as { _count: { _all: number } })._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  return json({ total, sources });
}
