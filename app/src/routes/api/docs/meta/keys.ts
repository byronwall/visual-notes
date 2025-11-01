import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";

export async function GET(_event: APIEvent) {
  const docs = await prisma.doc.findMany({
    where: { meta: { not: null } as any },
    select: { meta: true },
  });
  const counts = new Map<string, number>();
  for (const d of docs as any[]) {
    const m = d.meta;
    if (!m || typeof m !== "object") continue;
    for (const k of Object.keys(m)) {
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  const items = Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
  return json({ keys: items });
}
