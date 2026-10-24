import { z } from "zod";
import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import { ensureInboxList, INBOX_LIST_NAME } from "~/server/notes/inline-tasks";
import * as store from "~/server/tasks/task-store";
import { TASK_STATUSES } from "~/services/tasks/tasks.types";
import {
  agentContext,
  appLink,
  ConnectorError,
  dayArg,
  isAgentNote,
  limitArg,
  noteAppUrl,
  nothingWritten,
  resolveByIdOrName,
  type ConnectorContext,
} from "./shared";
import type { ToolRegistrar } from "./tool-registry";

// Task lists and tasks over the connector, through the same store the Tasks
// page uses. Agents can create, update, and move any task. A task written as
// a line in a note the user wrote keeps its text there, so only its status,
// dates, tags, and place can change. Deleting stays with the user; agents
// mark work cancelled instead.

export const TASK_INSTRUCTIONS =
  "Tasks live in lists; Inbox also holds the task lines written in notes. tasks_query finds work (open tasks by default; inNotes for note task lines), tasks_create adds it, tasks_update changes status, dates, and tags (cancel instead of deleting), and tasks_move re-parents or files a task in another list. dueDate is a day with no time and no reminder: tell the user 'due October 23', never a time of day.";

const statusArg = z.enum(TASK_STATUSES);
const listArg = z
  .string()
  .min(1)
  .describe("List id or exact name (case-insensitive)");
const metaArg = z.record(z.string().max(128), z.string().max(4000));
const durationArg = z.number().int().min(1).max(43_200);

const taskView = (ctx: ConnectorContext, task: store.TaskRow) => ({
  id: task.id,
  listId: task.listId,
  list: task.list.name,
  description: task.description,
  status: task.status,
  dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
  durationMinutes: task.durationMinutes,
  tags: task.tags,
  meta: task.meta,
  parentTaskId: task.parentTaskId,
  note: task.sourceDocId
    ? {
        id: task.sourceDocId,
        title: task.sourceDoc?.title ?? null,
        blockId: task.sourceBlockId,
        appUrl: noteAppUrl(ctx, task.sourceDocId),
      }
    : null,
  /** False when the text lives in a note the user wrote. */
  textEditable: !task.sourceDoc || isAgentNote(task.sourceDoc),
});

async function resolveList(
  ref: string | undefined,
): Promise<{ id: string; name: string }> {
  if (!ref?.trim()) {
    const id = await ensureInboxList();
    return { id, name: INBOX_LIST_NAME };
  }
  const select = { id: true, name: true } as const;
  return resolveByIdOrName(ref, {
    kind: "task list",
    byId: (id) => prisma.taskList.findUnique({ where: { id }, select }),
    byName: (name) =>
      prisma.taskList.findMany({
        where: { name: { equals: name, mode: "insensitive" } },
        select,
      }),
    listTool: "tasks_list_lists or tasks_create_list",
  });
}

export function registerTaskTools(tools: ToolRegistrar): void {
  const { ctx } = tools;
  const log = (
    eventType: string,
    entityId: string,
    payload: Record<string, string | number | boolean | null | string[]>,
  ) =>
    logActionEvent({
      eventType,
      entityType: eventType.startsWith("task_list") ? "task_list" : "task",
      entityId,
      payload,
      context: agentContext(ctx),
    });
  const view = (task: store.TaskRow) => taskView(ctx, task);
  const reload = async (id: string) => view((await store.getTasks([id]))[0]!);

  tools.read(
    "tasks_list_lists",
    {
      title: "List task lists",
      description:
        "Task lists in the order the user keeps them, with open and total counts.",
    },
    async () => ({
      lists: await store.listTaskListsWithCounts(),
      appUrl: appLink(ctx, "/tasks"),
    }),
  );

  tools.read(
    "tasks_query",
    {
      title: "Query tasks",
      description:
        "Tasks across lists, filtered. Defaults to open tasks (waiting/started/deferred); pass status to see others. Each task names the note it was written in, if any.",
      input: {
        list: listArg.optional(),
        status: z.array(statusArg).optional(),
        dueBefore: dayArg.optional().describe("Due on or before this day"),
        dueAfter: dayArg.optional().describe("Due on or after this day"),
        tag: z.string().optional(),
        noteId: z
          .string()
          .optional()
          .describe("Only tasks written as lines in this note"),
        inNotes: z
          .boolean()
          .optional()
          .describe("Only tasks written as lines in any note"),
        text: z.string().optional().describe("Words in the description"),
        topLevelOnly: z.boolean().optional(),
        limit: limitArg(500, 100),
      },
    },
    async (args) => {
      const list = args.list ? await resolveList(args.list) : null;
      const rows = await store.queryTasks({
        listId: list?.id,
        status: args.status,
        openOnly: !args.status?.length,
        dueBefore: args.dueBefore,
        dueAfter: args.dueAfter,
        tag: args.tag,
        sourceDocId: args.noteId,
        inNotes: args.inNotes,
        text: args.text,
        parentTaskId: args.topLevelOnly ? null : undefined,
        limit: args.limit,
      });
      return { tasks: rows.map(view) };
    },
  );

  tools.write(
    "tasks_create",
    {
      title: "Create task",
      description:
        "Add a task to a list (Inbox when list is omitted), optionally under a parent task. For a task that belongs in a note, write a `- [ ] …` line in the note instead.",
      input: {
        description: z.string().min(1).max(4000),
        list: listArg.optional(),
        parentTaskId: z.string().optional(),
        status: statusArg.optional(),
        dueDate: dayArg.optional().describe("Day it is due; tasks store no time"),
        durationMinutes: durationArg.optional(),
        tags: z.array(z.string().max(80)).optional(),
        meta: metaArg.optional(),
      },
    },
    async ({ list, ...input }) => {
      const target = await resolveList(list);
      const created = await store.createTask({ ...input, listId: target.id });
      await log("task.created", created.id, {
        description: input.description,
        list: target.name,
      });
      return reload(created.id);
    },
  );

  tools.write(
    "tasks_update",
    {
      title: "Update tasks",
      description:
        "Change status, description, due date, duration, tags, or meta on up to 50 tasks. Fields you leave out stay as they are; pass null to clear dueDate, durationMinutes, or meta. The description of a task that lives in a note the user wrote can't be changed.",
      input: {
        updates: z
          .array(
            z.object({
              id: z.string().min(1),
              status: statusArg.optional(),
              description: z.string().min(1).max(4000).optional(),
              dueDate: dayArg
                .nullable()
                .optional()
                .describe("Day it is due; tasks store no time"),
              durationMinutes: durationArg.nullable().optional(),
              tags: z.array(z.string().max(80)).optional(),
              meta: metaArg.nullable().optional(),
            }),
          )
          .min(1)
          .max(50),
      },
      idempotent: true,
    },
    async ({ updates }) => {
      const ids = updates.map((u) => u.id);
      const rows = new Map(
        (await store.getTasks(ids)).map((row) => [row.id, row]),
      );
      const problems: string[] = [];
      for (const update of updates) {
        const row = rows.get(update.id);
        if (!row) problems.push(`no task "${update.id}"`);
        else if (update.description !== undefined && !view(row).textEditable) {
          problems.push(
            `task "${update.id}" is a line in "${row.sourceDoc?.title}", which the user wrote; its text can't change`,
          );
        }
      }
      if (problems.length)
        throw new ConnectorError("invalid", nothingWritten(problems));
      for (const update of updates) {
        await store.updateTask(update);
        await log("task.updated", update.id, {
          description: update.description ?? rows.get(update.id)!.description,
          fieldsChanged: Object.keys(update).filter((key) => key !== "id"),
          ...(update.status ? { status: update.status } : {}),
        });
      }
      return { tasks: (await store.getTasks(ids)).map(view) };
    },
  );

  tools.write(
    "tasks_move",
    {
      title: "Move task",
      description:
        "Move a task (and everything under it) to another list, or within its list under a new parent at a position. Pass list to change lists; otherwise parentTaskId (null = top level) and index.",
      input: {
        id: z.string().min(1),
        list: listArg.optional(),
        parentTaskId: z.string().nullable().optional(),
        index: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Position among the new siblings; defaults to the end"),
      },
    },
    async ({ id, list, parentTaskId, index }) => {
      const [row] = await store.getTasks([id]);
      if (!row) throw new ConnectorError("not_found", `No task "${id}".`);
      const target = list ? await resolveList(list) : null;
      if (target && target.id !== row.listId) {
        await store.moveTaskToList({ taskId: id, listId: target.id });
        await log("task.moved", id, {
          description: row.description,
          list: target.name,
        });
      }
      if (parentTaskId !== undefined || index !== undefined) {
        const parent =
          parentTaskId === undefined
            ? target
              ? null
              : row.parentTaskId
            : parentTaskId;
        const siblings = await prisma.taskItem.count({
          where: { listId: target?.id ?? row.listId, parentTaskId: parent },
        });
        await store.moveTask({
          taskId: id,
          targetParentTaskId: parent,
          targetIndex: index ?? siblings,
        });
        if (!target)
          await log("task.moved", id, {
            description: row.description,
            list: row.list.name,
          });
      }
      return reload(id);
    },
  );

  tools.write(
    "tasks_create_list",
    {
      title: "Create task list",
      description: "Add a task list at the end of the rail.",
      input: { name: z.string().min(1).max(200) },
    },
    async ({ name }) => {
      const created = await store.createTaskList({ name });
      await log("task_list.created", created.id, { name });
      return { id: created.id, name: name.trim() };
    },
  );

  tools.write(
    "tasks_rename_list",
    {
      title: "Rename task list",
      description:
        "Rename a task list. Deleting and reordering lists stay with the user.",
      input: { list: listArg, name: z.string().min(1).max(200) },
      idempotent: true,
    },
    async ({ list, name }) => {
      const target = await resolveList(list);
      await store.updateTaskList({ id: target.id, name });
      await log("task_list.renamed", target.id, {
        name,
        previousName: target.name,
      });
      return { id: target.id, name: name.trim() };
    },
  );
}
