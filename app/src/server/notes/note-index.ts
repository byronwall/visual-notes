import { Prisma } from "@prisma/client";
import { projectNote } from "~/lib/note-content/project";
import type { NoteDoc } from "~/lib/note-content/types";
import { prisma } from "~/server/db";

type Tx = Prisma.TransactionClient;

/**
 * Rebuilds a note's derived block and link rows from its content. Run it in
 * the same transaction as the content write so the index never drifts.
 */
export async function rebuildNoteIndex(tx: Tx, docId: string, doc: NoteDoc) {
  const { blocks, links } = projectNote(doc);
  const targetIds = [...new Set(links.map((l) => l.targetDocId))];
  const existing = targetIds.length
    ? await tx.doc.findMany({
        where: { id: { in: targetIds } },
        select: { id: true },
      })
    : [];
  const live = new Set(existing.map((d) => d.id));

  await tx.docBlock.deleteMany({ where: { docId } });
  await tx.docLink.deleteMany({ where: { sourceDocId: docId } });
  if (blocks.length) {
    await tx.docBlock.createMany({
      data: blocks.map((b) => ({
        docId,
        id: b.id,
        parentId: b.parentId,
        topLevelIndex: b.topLevelIndex,
        orderIndex: b.orderIndex,
        type: b.type,
        text: b.text,
        tags: b.tags,
        attrs: (b.attrs ?? undefined) as Prisma.InputJsonValue | undefined,
        hash: b.hash,
      })),
      skipDuplicates: true,
    });
  }
  const liveLinks = links.filter((l) => live.has(l.targetDocId));
  if (liveLinks.length) {
    await tx.docLink.createMany({
      data: liveLinks.map((l) => ({ sourceDocId: docId, ...l })),
    });
  }
  return { blocks: blocks.length, links: liveLinks.length };
}

/** Re-indexes every note that already has blocks (for index logic changes). */
export async function reindexAllNotes(batchSize = 100) {
  let cursor: string | undefined;
  let count = 0;
  for (;;) {
    const docs = await prisma.doc.findMany({
      where: { content: { not: Prisma.DbNull } },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, content: true },
    });
    if (docs.length === 0) break;
    for (const doc of docs) {
      if (!doc.content) continue;
      await prisma.$transaction((tx) =>
        rebuildNoteIndex(tx, doc.id, doc.content as unknown as NoteDoc),
      );
      count += 1;
    }
    cursor = docs[docs.length - 1].id;
  }
  console.info("[note-index] reindexed %d notes", count);
  return count;
}
