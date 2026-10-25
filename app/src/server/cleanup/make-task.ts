import { prisma } from "~/server/db";
import { archiveNotes } from "~/server/notes/note-archive";
import { ensureInboxList } from "~/server/notes/inline-tasks";
import { createTask } from "~/server/tasks/task-store";

/**
 * Make task: a note that is really a to-do becomes Inbox tasks, and the note
 * is archived. Checkboxes already written in the note are real tasks; they
 * are detached from the note so they outlive it.
 */

export type TaskPlan = {
  /** Open inline tasks that already live in the note. */
  existing: { id: string; description: string }[];
  /** Suggested new task descriptions (unchecked lines, or the title). */
  suggested: string[];
};

const UNCHECKED = /^\s*[-*]\s+\[ \]\s+(.+?)\s*(\^[\w-]+)?$/;
const BULLET = /^\s*[-*]\s+(?!\[[ xX]\])(.+?)\s*(\^[\w-]+)?$/;

/** Task lines from a note's markdown: unchecked boxes, else short bullets. */
export function taskLines(markdown: string): string[] {
  const lines = markdown.split("\n");
  const boxes = lines.flatMap((l) => l.match(UNCHECKED)?.[1] ?? []);
  if (boxes.length) return boxes;
  return lines
    .flatMap((l) => l.match(BULLET)?.[1] ?? [])
    .filter((l) => l.split(/\s+/).length <= 16)
    .slice(0, 12);
}

export async function taskPlan(
  docId: string,
  title: string,
  markdown: string,
): Promise<TaskPlan> {
  const existing = await prisma.taskItem.findMany({
    where: {
      sourceDocId: docId,
      status: { in: ["waiting", "started", "deferred"] },
    },
    select: { id: true, description: true },
    orderBy: { sortOrder: "asc" },
  });
  const known = new Set(existing.map((t) => t.description.trim()));
  const lines = taskLines(markdown).filter((l) => !known.has(l.trim()));
  return {
    existing,
    suggested: existing.length || lines.length ? lines : [title],
  };
}

export async function applyMakeTask(input: {
  docId: string;
  descriptions: string[];
}): Promise<{ created: number; kept: number }> {
  const doc = await prisma.doc.findUnique({
    where: { id: input.docId },
    select: { title: true },
  });
  if (!doc) throw new Error("Not found");
  const listId = await ensureInboxList();
  let created = 0;
  for (const description of input.descriptions
    .map((d) => d.trim())
    .filter(Boolean)) {
    await createTask({
      listId,
      description,
      meta: { cleanupFrom: doc.title },
    });
    created += 1;
  }
  const detached = await prisma.taskItem.updateMany({
    where: { sourceDocId: input.docId },
    data: { sourceDocId: null, sourceBlockId: null },
  });
  await archiveNotes({ docIds: [input.docId], reason: "make_task" });
  await prisma.noteAssessment.updateMany({
    where: { docId: input.docId },
    data: { decision: "done", decidedAt: new Date() },
  });
  return { created, kept: detached.count };
}
