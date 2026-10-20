import { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";

export type TagSummary = { tag: string; blocks: number; notes: number };

/** Every tag in use, most used first. */
export async function listTags(): Promise<TagSummary[]> {
  const rows = await prisma.$queryRaw<
    { tag: string; blocks: bigint; notes: bigint }[]
  >(Prisma.sql`
    SELECT t.tag, COUNT(*) AS blocks, COUNT(DISTINCT b."docId") AS notes
    FROM "DocBlock" b, unnest(b.tags) AS t(tag)
    GROUP BY t.tag
    ORDER BY COUNT(*) DESC, t.tag ASC
    LIMIT 500`);
  return rows.map((r) => ({
    tag: r.tag,
    blocks: Number(r.blocks),
    notes: Number(r.notes),
  }));
}

/** Tag names starting with `prefix`, for the # picker. */
export async function searchTagNames(prefix: string): Promise<string[]> {
  const like = `${prefix.toLowerCase().replace(/[%_]/g, "")}%`;
  const rows = await prisma.$queryRaw<{ tag: string }[]>(Prisma.sql`
    SELECT t.tag
    FROM "DocBlock" b, unnest(b.tags) AS t(tag)
    WHERE t.tag LIKE ${like}
    GROUP BY t.tag
    ORDER BY COUNT(*) DESC
    LIMIT 8`);
  return rows.map((r) => r.tag);
}

export type NoteGroup<T> = {
  docId: string;
  title: string;
  path: string | null;
  updatedAt: string;
  items: T[];
};

function groupByNote<T extends { docId: string }>(
  rows: T[],
  docs: Map<string, { title: string; path: string | null; updatedAt: Date }>,
): NoteGroup<T>[] {
  const groups = new Map<string, NoteGroup<T>>();
  for (const row of rows) {
    const doc = docs.get(row.docId);
    if (!doc) continue;
    let group = groups.get(row.docId);
    if (!group) {
      group = {
        docId: row.docId,
        title: doc.title,
        path: doc.path,
        updatedAt: doc.updatedAt.toISOString(),
        items: [],
      };
      groups.set(row.docId, group);
    }
    group.items.push(row);
  }
  return [...groups.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export type TaggedBlock = { docId: string; blockId: string; type: string; text: string };

/** Blocks carrying `tag`, grouped by note (most recently edited first). */
export async function listTagBlocks(tag: string): Promise<NoteGroup<TaggedBlock>[]> {
  const blocks = await prisma.docBlock.findMany({
    where: { tags: { has: tag.toLowerCase() } },
    orderBy: [{ docId: "asc" }, { orderIndex: "asc" }],
    select: { docId: true, id: true, type: true, text: true, parentId: true },
    take: 1000,
  });
  // A tag inside a list item's paragraph is reported once, on the outer block.
  const tagged = new Set(blocks.map((b) => `${b.docId}:${b.id}`));
  const outermost = blocks.filter(
    (b) => !b.parentId || !tagged.has(`${b.docId}:${b.parentId}`),
  );
  const docs = await prisma.doc.findMany({
    where: { id: { in: [...new Set(outermost.map((b) => b.docId))] } },
    select: { id: true, title: true, path: true, updatedAt: true },
  });
  return groupByNote(
    outermost.map((b) => ({ docId: b.docId, blockId: b.id, type: b.type, text: b.text })),
    new Map(docs.map((d) => [d.id, d])),
  );
}

export type NoteTask = {
  docId: string;
  taskId: string;
  blockId: string | null;
  description: string;
  status: string;
  dueDate: string | null;
};

/** Open tasks written inline in notes, grouped by note. */
export async function listOpenNoteTasks(): Promise<NoteGroup<NoteTask>[]> {
  const tasks = await prisma.taskItem.findMany({
    where: {
      sourceDocId: { not: null },
      status: { notIn: ["complete", "cancelled"] },
    },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      description: true,
      status: true,
      dueDate: true,
      sourceDocId: true,
      sourceBlockId: true,
      sourceDoc: { select: { id: true, title: true, path: true, updatedAt: true } },
    },
    take: 1000,
  });
  const docs = new Map(
    tasks.flatMap((t) => (t.sourceDoc ? [[t.sourceDoc.id, t.sourceDoc] as const] : [])),
  );
  return groupByNote(
    tasks.map((t) => ({
      docId: t.sourceDocId!,
      taskId: t.id,
      blockId: t.sourceBlockId,
      description: t.description,
      status: t.status,
      dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    })),
    docs,
  );
}
