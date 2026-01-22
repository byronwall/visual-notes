import { action, query } from "@solidjs/router";
import { prisma } from "~/server/db";

type CleanupCandidate = { id: string; title: string };
export type CleanupTitlesDryRunResult = {
  dryRun: true;
  total: number;
  candidates: number;
};
export type CleanupTitlesResult = {
  ok: true;
  updated: number;
  failed: number;
  total: number;
};

const HEX_BLOCK = /\b[a-f0-9]{16,}\b/gi;

function cleanTitle(input: string): string {
  // Remove long hex-like blocks, collapse spaces, trim common separators/space
  return input
    .replace(HEX_BLOCK, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-–—_:]+|[\s\-–—_:]+$/g, "")
    .trim();
}

async function buildCandidates(): Promise<{
  total: number;
  candidates: CleanupCandidate[];
}> {
  const docs = await prisma.doc.findMany({ select: { id: true, title: true } });
  const candidates = docs
    .map((d) => {
      const title = d.title || "";
      const cleaned = cleanTitle(title);
      return cleaned && cleaned !== title ? { id: d.id, title: cleaned } : null;
    })
    .filter(Boolean) as CleanupCandidate[];
  return { total: docs.length, candidates };
}

export const cleanupTitlesDryRun = query(
  async (): Promise<CleanupTitlesDryRunResult> => {
    "use server";
    const { total, candidates } = await buildCandidates();
    console.log("[docs.cleanup] dryRun candidates=", candidates.length);
    return { dryRun: true, total, candidates: candidates.length };
  },
  "docs-cleanup-titles-dry-run"
);

export const cleanupTitles = action(async (): Promise<CleanupTitlesResult> => {
  "use server";
  const { total, candidates } = await buildCandidates();

  if (candidates.length === 0) {
    return { ok: true, updated: 0, failed: 0, total };
  }

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
      console.error("[docs.cleanup] chunk failed, retrying individually", e);
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

  console.log("[docs.cleanup] completed updated=", updated, "failed=", failed);

  return { ok: true, updated, failed, total };
}, "docs-cleanup-titles");
