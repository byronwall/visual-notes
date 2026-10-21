import type { Prisma } from "@prisma/client";
import type { ProjectedTask } from "~/lib/note-content/project";
import { nodeText } from "~/lib/note-content/markdown";
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

const isDone = (status: unknown) => status === "complete" || status === "cancelled";

/**
 * Backs task lines an AI client wrote as markdown (`- [ ] …`, parsed into
 * taskRefs without a taskId) with real TaskItems. A line that replaced a task
 * line keeps that task (same block id, or else the same text), and its
 * checkbox sets the task's status. Lines that already carry a taskId were not
 * rewritten and are left alone. Returns the document with every taskId set.
 */
export async function materializeTaskRefs(
  tx: Tx,
  input: { previous: NoteDoc | null; next: NoteDoc; docId?: string | null },
): Promise<NoteDoc> {
  const byBlock = new Map<string, string>();
  const byText = new Map<string, string[]>();
  const kept = new Set<string>();
  const collect = (node: NoteNode, into: "previous" | "next") => {
    if (node.type === "taskRef" && node.attrs?.taskId) {
      const taskId = String(node.attrs.taskId);
      if (into === "next") kept.add(taskId);
      else {
        if (node.attrs.id) byBlock.set(String(node.attrs.id), taskId);
        const text = taskText(node);
        byText.set(text, [...(byText.get(text) ?? []), taskId]);
      }
    }
    node.content?.forEach((child) => collect(child, into));
  };
  if (input.previous) collect(input.previous, "previous");
  collect(input.next, "next");

  const pending: NoteNode[] = [];
  const visit = (node: NoteNode) => {
    if (node.type === "taskRef" && !node.attrs?.taskId) pending.push(node);
    node.content?.forEach(visit);
  };
  visit(input.next);
  if (!pending.length) return input.next;

  const claim = (node: NoteNode): string | null => {
    const fromBlock = node.attrs?.id ? byBlock.get(String(node.attrs.id)) : undefined;
    if (fromBlock && !kept.has(fromBlock)) return fromBlock;
    const sameText = (byText.get(taskText(node)) ?? []).find((id) => !kept.has(id));
    return sameText ?? null;
  };

  let listId: string | null = null;
  const assigned = new Map<NoteNode, { taskId: string; status: string }>();
  for (const node of pending) {
    const want = isDone(node.attrs?.status) ? "complete" : "waiting";
    const reused = claim(node);
    if (reused) {
      kept.add(reused);
      const row = await tx.taskItem.findUnique({ where: { id: reused }, select: { status: true } });
      if (row) {
        const status = isDone(row.status) === isDone(want) ? row.status : want;
        if (status !== row.status) {
          await tx.taskItem.update({ where: { id: reused }, data: { status } });
        }
        assigned.set(node, { taskId: reused, status });
        continue;
      }
    }
    listId ??= await ensureInboxList();
    const count = await tx.taskItem.count({ where: { listId, parentTaskId: null } });
    const created = await tx.taskItem.create({
      data: {
        listId,
        description: taskText(node) || "Untitled task",
        status: want,
        sortOrder: count,
        sourceDocId: input.docId ?? null,
      },
      select: { id: true },
    });
    kept.add(created.id);
    assigned.set(node, { taskId: created.id, status: want });
  }
  console.info("[inline-tasks] materialized %d task line(s)", assigned.size);

  const rewrite = (node: NoteNode): NoteNode => {
    const hit = assigned.get(node);
    if (hit) return { ...node, attrs: { ...node.attrs, taskId: hit.taskId, status: hit.status } };
    return node.content ? { ...node, content: node.content.map(rewrite) } : node;
  };
  return rewrite(input.next) as NoteDoc;
}

const taskText = (node: NoteNode) => nodeText(node).trim();
