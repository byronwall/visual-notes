import type { Prisma } from "@prisma/client";
import type { ProjectedTask } from "~/lib/note-content/project";
import type { NoteDoc, NoteNode } from "~/lib/note-content/types";
import { prisma } from "~/server/db";

type Tx = Prisma.TransactionClient;

export const INBOX_LIST_NAME = "Inbox";

/**
 * The list new inline tasks go into, created on first use. An advisory lock
 * keeps two tasks created at the same moment from making two Inbox lists.
 */
export async function ensureInboxList(): Promise<string> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('visual-notes:inbox-list'))`;
    const existing = await tx.taskList.findFirst({
      where: { name: INBOX_LIST_NAME },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (existing) return existing.id;
    const max = await tx.taskList.aggregate({ _max: { sortOrder: true } });
    const created = await tx.taskList.create({
      data: { name: INBOX_LIST_NAME, sortOrder: (max._max.sortOrder ?? -1) + 1 },
      select: { id: true },
    });
    console.info("[inline-tasks] created Inbox list %s", created.id);
    return created.id;
  });
}

/**
 * Points every task referenced in the note back at its block, copies the
 * note's text into the task description, and detaches tasks whose block
 * was removed (the task itself is kept).
 */
export async function syncInlineTasks(tx: Tx, docId: string, tasks: ProjectedTask[]) {
  const ids = tasks.map((t) => t.taskId);
  const existing = ids.length
    ? await tx.taskItem.findMany({
        where: { id: { in: ids } },
        select: { id: true, description: true, sourceDocId: true, sourceBlockId: true },
      })
    : [];
  const byId = new Map(existing.map((t) => [t.id, t]));
  for (const task of tasks) {
    const row = byId.get(task.taskId);
    if (!row) continue;
    const description = task.text || row.description;
    if (
      row.sourceDocId === docId &&
      row.sourceBlockId === task.blockId &&
      row.description === description
    ) {
      continue;
    }
    await tx.taskItem.update({
      where: { id: task.taskId },
      data: { sourceDocId: docId, sourceBlockId: task.blockId, description },
    });
  }
  await tx.taskItem.updateMany({
    where: { sourceDocId: docId, ...(ids.length ? { id: { notIn: ids } } : {}) },
    data: { sourceDocId: null, sourceBlockId: null },
  });
}

/**
 * Refreshes each task line from its TaskItem: status always, text when the
 * task was renamed elsewhere (e.g. in Tasks). Returns a new document.
 */
export async function resolveTaskRefs(doc: NoteDoc): Promise<NoteDoc> {
  const ids: string[] = [];
  const collect = (node: NoteNode) => {
    if (node.type === "taskRef" && node.attrs?.taskId) ids.push(String(node.attrs.taskId));
    node.content?.forEach(collect);
  };
  collect(doc);
  if (ids.length === 0) return doc;
  const rows = await prisma.taskItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, description: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const visit = (node: NoteNode): NoteNode => {
    if (node.type === "taskRef" && node.attrs?.taskId) {
      const row = byId.get(String(node.attrs.taskId));
      if (!row) return node;
      const currentText = (node.content ?? []).map((c) => c.text ?? "").join("");
      const renamed = row.description.trim() && row.description !== currentText;
      return {
        ...node,
        attrs: { ...node.attrs, status: row.status },
        ...(renamed ? { content: [{ type: "text", text: row.description }] } : {}),
      };
    }
    if (!node.content) return node;
    return { ...node, content: node.content.map(visit) };
  };
  return visit(doc) as NoteDoc;
}
