import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z, ZodError } from "zod";
import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import { ensureInboxList, INBOX_LIST_NAME } from "~/server/notes/inline-tasks";
import * as store from "~/server/tasks/task-store";
import { TASK_STATUSES } from "~/services/tasks/tasks.types";
import { ConnectorError, isChatGptNote, noteUrl, type ConnectorContext } from "./notes-shared";

// Task lists and tasks over the connector, through the same store the Tasks
// page uses. Agents can create, update, and move any task. A task written as
// a line in a note the user wrote keeps its text there, so only its status,
// dates, tags, and place can change. Deleting stays with the user; agents
// mark work cancelled instead.

export const TASK_TOOL_SCOPES: Record<string, string> = {
  tasks_list_lists: "notes:read",
  tasks_query: "notes:read",
  tasks_create: "notes:write",
  tasks_update: "notes:write",
  tasks_move: "notes:write",
  tasks_create_list: "notes:write",
  tasks_rename_list: "notes:write",
};

export const TASK_INSTRUCTIONS =
  "Tasks live in lists (Inbox holds task lines written in notes). Use tasks_query to find work (open tasks, due dates, tags, a note's tasks), tasks_update to change status/dates/tags (cancel instead of deleting), tasks_create for new work, and tasks_move to re-parent or move to another list.";

type Guarded = (ctx: ConnectorContext, tool: string, fn: () => Promise<unknown>) => Promise<CallToolResult>;

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

const statusArg = z.enum(TASK_STATUSES);
const dateArg = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD")
  .describe("YYYY-MM-DD");
const listArg = z.string().min(1).describe("List id or exact name (case-insensitive).");
const metaArg = z.record(z.string().max(128), z.string().max(4000));

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
  source: task.sourceDocId
    ? {
        noteId: task.sourceDocId,
        title: task.sourceDoc?.title ?? null,
        blockId: task.sourceBlockId,
        url: noteUrl(ctx, task.sourceDocId),
      }
    : null,
  /** False when the text lives in a note the user wrote. */
  textEditable: !task.sourceDoc || isChatGptNote(task.sourceDoc),
});

/** Store validation errors become a refusal the agent can fix. */
const refusing = async <T>(work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ConnectorError("invalid", error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    }
    if (error instanceof Error && /not found|invalid|cannot/i.test(error.message)) {
      throw new ConnectorError("invalid", error.message);
    }
    throw error;
  }
};

async function resolveList(ref: string | undefined): Promise<{ id: string; name: string }> {
  if (!ref?.trim()) {
    const id = await ensureInboxList();
    return { id, name: INBOX_LIST_NAME };
  }
  const value = ref.trim();
  const list =
    (await prisma.taskList.findUnique({ where: { id: value }, select: { id: true, name: true } })) ??
    (await prisma.taskList.findFirst({
      where: { name: { equals: value, mode: "insensitive" } },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }));
  if (!list) throw new ConnectorError("not_found", `No task list "${value}". Use tasks_list_lists or tasks_create_list.`);
  return list;
}

export function registerTaskTools(server: McpServer, ctx: ConnectorContext, guarded: Guarded): void {
  const context = { actorId: ctx.actorId, actorType: "chatgpt" as const };
  const log = (eventType: string, entityId: string, payload: Record<string, string | number | boolean | null | string[]>) =>
    logActionEvent({ eventType, entityType: eventType.startsWith("task_list") ? "task_list" : "task", entityId, payload, context });

  server.registerTool(
    "tasks_list_lists",
    {
      title: "List task lists",
      description: "Task lists in the order the user keeps them, with open and total counts.",
      annotations: readOnly,
    },
    () => guarded(ctx, "tasks_list_lists", () => store.listTaskListsWithCounts()),
  );

  server.registerTool(
    "tasks_query",
    {
      title: "Find tasks",
      description:
        "Tasks across lists, filtered. Defaults to open tasks (waiting/started/deferred); pass status to see others. Each task says which note it came from, if any.",
      inputSchema: {
        list: listArg.optional(),
        status: z.array(statusArg).optional(),
        dueBefore: dateArg.optional().describe("Due on or before this date"),
        dueAfter: dateArg.optional().describe("Due on or after this date"),
        tag: z.string().optional(),
        noteId: z.string().optional().describe("Only tasks written as lines in this note"),
        text: z.string().optional().describe("Words in the description"),
        topLevelOnly: z.boolean().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      },
      annotations: readOnly,
    },
    (args) =>
      guarded(ctx, "tasks_query", async () => {
        const list = args.list ? await resolveList(args.list) : null;
        const rows = await refusing(() =>
          store.queryTasks({
            listId: list?.id,
            status: args.status,
            openOnly: !args.status?.length,
            dueBefore: args.dueBefore,
            dueAfter: args.dueAfter,
            tag: args.tag,
            sourceDocId: args.noteId,
            text: args.text,
            parentTaskId: args.topLevelOnly ? null : undefined,
            limit: args.limit,
          }),
        );
        return rows.map((row) => taskView(ctx, row));
      }),
  );

  server.registerTool(
    "tasks_create",
    {
      title: "Create task",
      description:
        "Add a task to a list (Inbox when list is omitted), optionally under a parent task. For a task that belongs in a note, write a `- [ ] …` line in the note instead.",
      inputSchema: {
        description: z.string().min(1).max(4000),
        list: listArg.optional(),
        parentTaskId: z.string().optional(),
        status: statusArg.optional(),
        dueDate: dateArg.optional(),
        durationMinutes: z.number().int().min(1).max(43_200).optional(),
        tags: z.array(z.string().max(80)).optional(),
        meta: metaArg.optional(),
      },
      annotations: write,
    },
    ({ list, ...input }) =>
      guarded(ctx, "tasks_create", async () => {
        const target = await resolveList(list);
        const created = await refusing(() => store.createTask({ ...input, listId: target.id }));
        await log("task.created", created.id, { description: input.description, list: target.name });
        const [row] = await store.getTasks([created.id]);
        return taskView(ctx, row);
      }),
  );

  server.registerTool(
    "tasks_update",
    {
      title: "Update tasks",
      description:
        "Change status, description, due date, duration, tags, or meta on up to 50 tasks. Fields you leave out stay as they are; pass null to clear dueDate, durationMinutes, or meta. The description of a task that lives in a note the user wrote can't be changed.",
      inputSchema: {
        updates: z
          .array(
            z.object({
              id: z.string().min(1),
              status: statusArg.optional(),
              description: z.string().min(1).max(4000).optional(),
              dueDate: dateArg.nullable().optional(),
              durationMinutes: z.number().int().min(1).max(43_200).nullable().optional(),
              tags: z.array(z.string().max(80)).optional(),
              meta: metaArg.nullable().optional(),
            }),
          )
          .min(1)
          .max(50),
      },
      annotations: { ...write, idempotentHint: true },
    },
    ({ updates }) =>
      guarded(ctx, "tasks_update", async () => {
        const rows = new Map((await store.getTasks(updates.map((u) => u.id))).map((row) => [row.id, row]));
        const problems: string[] = [];
        for (const update of updates) {
          const row = rows.get(update.id);
          if (!row) problems.push(`no task "${update.id}"`);
          else if (update.description !== undefined && !taskView(ctx, row).textEditable) {
            problems.push(`task "${update.id}" is a line in "${row.sourceDoc?.title}", which the user wrote; its text can't change`);
          }
        }
        if (problems.length) {
          throw new ConnectorError("invalid", `Nothing was changed. Fix these and retry:\n${problems.map((p) => `- ${p}`).join("\n")}`);
        }
        for (const update of updates) {
          await refusing(() => store.updateTask(update));
          await log("task.updated", update.id, {
            description: update.description ?? rows.get(update.id)!.description,
            fieldsChanged: Object.keys(update).filter((key) => key !== "id"),
            ...(update.status ? { status: update.status } : {}),
          });
        }
        return (await store.getTasks(updates.map((u) => u.id))).map((row) => taskView(ctx, row));
      }),
  );

  server.registerTool(
    "tasks_move",
    {
      title: "Move task",
      description:
        "Move a task (and everything under it) to another list, or within its list under a new parent at a position. Pass list to change lists; otherwise parentTaskId (null = top level) and index.",
      inputSchema: {
        id: z.string().min(1),
        list: listArg.optional(),
        parentTaskId: z.string().nullable().optional(),
        index: z.number().int().min(0).optional().describe("Position among the new siblings; defaults to the end"),
      },
      annotations: write,
    },
    ({ id, list, parentTaskId, index }) =>
      guarded(ctx, "tasks_move", async () => {
        const [row] = await store.getTasks([id]);
        if (!row) throw new ConnectorError("not_found", `No task "${id}".`);
        const target = list ? await resolveList(list) : null;
        if (target && target.id !== row.listId) {
          await refusing(() => store.moveTaskToList({ taskId: id, listId: target.id }));
          await log("task.moved", id, { description: row.description, list: target.name });
        }
        if (parentTaskId !== undefined || index !== undefined) {
          const parent = parentTaskId === undefined ? (target ? null : row.parentTaskId) : parentTaskId;
          const siblings = await prisma.taskItem.count({ where: { listId: target?.id ?? row.listId, parentTaskId: parent } });
          await refusing(() =>
            store.moveTask({ taskId: id, targetParentTaskId: parent, targetIndex: index ?? siblings }),
          );
          if (!target) await log("task.moved", id, { description: row.description, list: row.list.name });
        }
        const [moved] = await store.getTasks([id]);
        return taskView(ctx, moved);
      }),
  );

  server.registerTool(
    "tasks_create_list",
    {
      title: "Create task list",
      description: "Add a task list at the end of the rail.",
      inputSchema: { name: z.string().min(1).max(200) },
      annotations: write,
    },
    ({ name }) =>
      guarded(ctx, "tasks_create_list", async () => {
        const created = await refusing(() => store.createTaskList({ name }));
        await log("task_list.created", created.id, { name });
        return { id: created.id, name: name.trim() };
      }),
  );

  server.registerTool(
    "tasks_rename_list",
    {
      title: "Rename task list",
      inputSchema: { list: listArg, name: z.string().min(1).max(200) },
      annotations: write,
    },
    ({ list, name }) =>
      guarded(ctx, "tasks_rename_list", async () => {
        const target = await resolveList(list);
        await refusing(() => store.updateTaskList({ id: target.id, name }));
        await log("task_list.renamed", target.id, { name, previousName: target.name });
        return { id: target.id, name: name.trim() };
      }),
  );
}
