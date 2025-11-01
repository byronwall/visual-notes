import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const key = url.searchParams.get("key");
  if (!key) return json({ error: "Missing key" }, { status: 400 });

  const docs = await prisma.doc.findMany({
    where: { meta: { path: [key], not: null } as any },
    select: { meta: true },
  });
  const counts = new Map<string, number>();
  for (const d of docs as any[]) {
    const m = d.meta as Record<string, unknown> | null;
    if (!m || typeof m !== "object") continue;
    const raw = (m as any)[key];
    if (raw === null || raw === undefined) continue;
    const val = String(raw);
    counts.set(val, (counts.get(val) || 0) + 1);
  }
  const items = Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
  return json({ values: items });
}
