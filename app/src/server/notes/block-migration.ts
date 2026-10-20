import { Prisma } from "@prisma/client";
import sanitizeHtml from "sanitize-html";
import { contentFromLegacy, toPlainText } from "~/lib/note-content/convert";
import { prisma } from "~/server/db";
import { rebuildNoteIndex } from "./note-index";
import { contentColumns } from "./note-store";

/**
 * One-time conversion of legacy html/markdown notes into blocks. Batches are
 * idempotent: only notes without `content` are touched. Applying a batch
 * snapshots each note into a `block-migration` revision first and leaves the
 * legacy columns as they were, so the read switch can fall back to them.
 */

export type BlockMigrationRow = {
  id: string;
  title: string;
  beforeChars: number;
  afterChars: number;
  lossPct: number;
  error?: string;
};

export type BlockMigrationBatch = {
  dryRun: boolean;
  processed: number;
  migrated: number;
  failed: number;
  /** Notes still without blocks after this batch. */
  remaining: number;
  /** Cursor for the next dry-run page (dry runs do not shrink the queue). */
  nextCursor: string | null;
  rows: BlockMigrationRow[];
};

const unmigrated = { content: { equals: Prisma.DbNull } } as const;

const visibleChars = (text: string) => text.replace(/\s+/g, "").length;

export function legacyText(row: { html: string; markdown: string }): string {
  if (row.html.trim()) {
    return sanitizeHtml(row.html, {
      allowedTags: [],
      allowedAttributes: {},
      nonTextTags: ["style", "script", "textarea", "noscript"],
    });
  }
  return row.markdown.replace(/[#>*_`~|-]/g, "");
}

export function measureConversion(row: {
  id: string;
  title: string;
  html: string;
  markdown: string;
}) {
  const content = contentFromLegacy(row);
  const beforeChars = visibleChars(legacyText(row));
  const afterChars = visibleChars(toPlainText(content));
  const lossPct =
    beforeChars > 0
      ? Math.max(0, Math.round(((beforeChars - afterChars) / beforeChars) * 1000) / 10)
      : 0;
  return { content, beforeChars, afterChars, lossPct };
}

export async function countUnmigratedNotes() {
  const [total, remaining] = await Promise.all([
    prisma.doc.count(),
    prisma.doc.count({ where: unmigrated }),
  ]);
  return { total, remaining, migrated: total - remaining };
}

export async function runBlockMigrationBatch(opts: {
  dryRun: boolean;
  limit?: number;
  cursor?: string | null;
}): Promise<BlockMigrationBatch> {
  const limit = Math.max(1, Math.min(500, opts.limit ?? 100));
  const docs = await prisma.doc.findMany({
    where: {
      ...unmigrated,
      ...(opts.dryRun && opts.cursor ? { id: { gt: opts.cursor } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit,
    select: { id: true, title: true, path: true, html: true, markdown: true },
  });

  const rows: BlockMigrationRow[] = [];
  let migrated = 0;
  let failed = 0;
  for (const doc of docs) {
    try {
      const { content, ...stats } = measureConversion(doc);
      rows.push({ id: doc.id, title: doc.title, ...stats });
      if (opts.dryRun) continue;
      const { content: json, contentSchemaVersion } = contentColumns(content);
      await prisma.$transaction(async (tx) => {
        await tx.docRevision.create({
          data: {
            docId: doc.id,
            title: doc.title,
            path: doc.path,
            markdown: doc.markdown,
            html: doc.html,
            actorType: "system",
            reason: "block-migration",
          },
        });
        await tx.doc.update({
          where: { id: doc.id },
          data: {
            content: json,
            contentSchemaVersion,
            contentVersion: { increment: 1 },
          },
        });
        await rebuildNoteIndex(tx, doc.id, content);
      });
      migrated += 1;
    } catch (e) {
      failed += 1;
      rows.push({
        id: doc.id,
        title: doc.title,
        beforeChars: 0,
        afterChars: 0,
        lossPct: 100,
        error: (e as Error).message || "conversion failed",
      });
    }
  }
  console.info(
    "[block-migration] %s batch processed=%d migrated=%d failed=%d",
    opts.dryRun ? "dry-run" : "apply",
    docs.length,
    migrated,
    failed,
  );
  const { remaining } = await countUnmigratedNotes();
  return {
    dryRun: opts.dryRun,
    processed: docs.length,
    migrated,
    failed,
    remaining,
    nextCursor: docs.length === limit ? docs[docs.length - 1].id : null,
    rows,
  };
}
