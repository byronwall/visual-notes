import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";

function cleanTitle(input: string): string {
  // Remove long hex-like blocks, collapse spaces, trim common separators/space
  const HEX_BLOCK = /\b[a-f0-9]{16,}\b/gi;
  return input
    .replace(HEX_BLOCK, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-–—_:]+|[\s\-–—_:]+$/g, "")
    .trim();
}

export async function POST(event: APIEvent) {
  const url = new URL(event.request.url);
  const dryRun =
    url.searchParams.get("dryRun") === "1" ||
    url.searchParams.get("dryRun") === "true";

  // Fetch only id and title for performance
  const docs = await prisma.doc.findMany({ select: { id: true, title: true } });

  // Compute candidates in memory
  const candidates = docs
    .map((d) => {
      const title = d.title || "";
      const cleaned = cleanTitle(title);
      return cleaned && cleaned !== title ? { id: d.id, title: cleaned } : null;
    })
    .filter(Boolean) as { id: string; title: string }[];

  if (dryRun) {
    try {
      console.log("[api.docs.cleanup] dryRun candidates=", candidates.length);
    } catch {}
    return json({
      dryRun: true,
      total: docs.length,
      candidates: candidates.length,
    });
  }

  if (candidates.length === 0) {
    return json({ ok: true, updated: 0, failed: 0, total: docs.length });
  }

  // Batch updates in chunks to avoid oversized transactions
  const chunkSize = 100;
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i += chunkSize) {
    const chunk = candidates.slice(i, i + chunkSize);
    try {
      await prisma.$transaction(
        chunk.map((c) =>
          prisma.doc.update({ where: { id: c.id }, data: { title: c.title } })
        )
      );
      updated += chunk.length;
    } catch (e) {
      // If a chunk fails, try individual updates to count failures accurately
      try {
        console.error(
          "[api.docs.cleanup] chunk failed, retrying individually",
          e
        );
      } catch {}
      for (const c of chunk) {
        try {
          await prisma.doc.update({
            where: { id: c.id },
            data: { title: c.title },
          });
          updated++;
        } catch (_e) {
          failed++;
        }
      }
    }
  }

  try {
    console.log(
      "[api.docs.cleanup] completed updated=",
      updated,
      "failed=",
      failed
    );
  } catch {}

  return json({ ok: true, updated, failed, total: docs.length });
}
