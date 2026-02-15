import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import type { SourcesResponse } from "./docs.types";

export const fetchSources = query(async (): Promise<SourcesResponse> => {
  "use server";
  const startedAt = Date.now();
  const [total, groups] = await Promise.all([
    prisma.doc.count({}),
    prisma.doc.groupBy({
      by: ["originalSource"],
      _count: { _all: true },
      where: { originalSource: { not: null } },
    }),
  ]);

  const sources = groups
    .filter((g) => typeof g.originalSource === "string")
    .map((g) => ({
      originalSource: g.originalSource as string,
      count: (g as unknown as { _count: { _all: number } })._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  console.log("[docs-index] fetchSources", {
    ms: Date.now() - startedAt,
    totalDocs: total,
    sourceCount: sources.length,
  });
  return { total, sources };
}, "docs-index-sources");
