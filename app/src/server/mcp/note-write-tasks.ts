import { prisma } from "~/server/db";
import type { NoteDoc, NoteNode } from "~/lib/note-content/types";

// What a note write did to the Inbox. Every top-level `- [ ]` line is a real
// task, so the write's answer lists them with what was stored (a due day, no
// time) and warns when one write files a whole procedure as separate tasks.

/** One write adding more new task lines than this gets a notice. */
export const MANY_NEW_TASKS = 3;
const MAX_LISTED = 50;

export type NoteTaskLine = {
  id: string;
  description: string;
  status: string;
  /** The day it is due; tasks store no time of day. */
  dueDate: string | null;
  /** True when this write created the task. */
  created: boolean;
};

export type NoteTaskReport = {
  tasks?: NoteTaskLine[];
  notice?: string;
};

export function taskIdsIn(doc: NoteDoc | null): string[] {
  const ids: string[] = [];
  const visit = (node: NoteNode) => {
    if (node.type === "taskRef" && node.attrs?.taskId)
      ids.push(String(node.attrs.taskId));
    node.content?.forEach(visit);
  };
  if (doc) visit(doc);
  return ids;
}

/** The note's task lines after a write, in note order. Empty when it has none. */
export async function reportNoteTasks(
  previous: NoteDoc | null,
  next: NoteDoc,
): Promise<NoteTaskReport> {
  const ids = taskIdsIn(next);
  if (!ids.length) return {};
  const before = new Set(taskIdsIn(previous));
  const rows = await prisma.taskItem.findMany({
    where: { id: { in: ids.slice(0, MAX_LISTED) } },
    select: { id: true, description: true, status: true, dueDate: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const tasks = ids.slice(0, MAX_LISTED).flatMap((id) => {
    const row = byId.get(id);
    if (!row) return [];
    return [
      {
        id,
        description: row.description,
        status: row.status,
        dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
        created: !before.has(id),
      },
    ];
  });
  const created = ids.filter((id) => !before.has(id)).length;
  if (created <= MANY_NEW_TASKS) return { tasks };
  return {
    tasks,
    notice: `This write added ${created} tasks to the Inbox, one per top-level "- [ ]" line. If they are steps of one job, keep one task line for the job, write the steps as a numbered list (notes_edit_blocks), and cancel the extra tasks with tasks_update. Set a due day with tasks_update using the ids above.`,
  };
}
