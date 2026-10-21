import { z } from "zod";
import { prisma } from "~/server/db";
import { ensureInboxList } from "~/server/notes/inline-tasks";
import { publishAppChange } from "~/server/note-events";

// Plain server functions (not router actions): the editor calls them from a
// ProseMirror plugin and a NodeView, outside any component's router context.

/** Creates the TaskItem behind a new checkbox line in a note (Inbox list). */
export async function createInlineTask(input: {
  description: string;
  docId?: string | null;
}) {
  "use server";
  const parsed = z
    .object({ description: z.string().max(2000), docId: z.string().nullish() })
    .parse(input);
  const listId = await ensureInboxList();
  const count = await prisma.taskItem.count({ where: { listId, parentTaskId: null } });
  const docExists = parsed.docId
    ? await prisma.doc.count({ where: { id: parsed.docId } })
    : 0;
  const task = await prisma.taskItem.create({
    data: {
      listId,
      description: parsed.description.trim() || "Untitled task",
      status: "waiting",
      sortOrder: count,
      sourceDocId: docExists ? parsed.docId : null,
    },
    select: { id: true, status: true },
  });
  console.info("[inline-tasks] created task %s", task.id);
  publishAppChange("tasks", [listId]);
  return task;
}

/** Checks or unchecks an inline task. */
export async function setInlineTaskDone(input: { taskId: string; done: boolean }) {
  "use server";
  const parsed = z.object({ taskId: z.string().min(1), done: z.boolean() }).parse(input);
  const task = await prisma.taskItem.update({
    where: { id: parsed.taskId },
    data: { status: parsed.done ? "complete" : "waiting" },
    select: { id: true, status: true, listId: true },
  });
  publishAppChange("tasks", [task.listId]);
  return { id: task.id, status: task.status };
}
