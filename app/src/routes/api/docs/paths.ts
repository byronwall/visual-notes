import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";

export async function GET(_event: APIEvent) {
  const groups = await prisma.doc.groupBy({
    by: ["path"],
    _count: { _all: true },
    where: { path: { not: null } },
  });
  const items = groups
    .filter((g) => typeof g.path === "string")
    .map((g) => ({
      path: g.path as string,
      count: (g as unknown as { _count: { _all: number } })._count._all,
    }))
    .sort((a, b) => b.count - a.count);
  return json({ paths: items });
}


