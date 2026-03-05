import { action } from "@solidjs/router";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "~/server/db";
import { TASK_STATUSES } from "./tasks.types";

const statusEnum = z.enum(TASK_STATUSES);
const idString = z.string().min(1);

const metaInput = z.record(z.string().max(128), z.string().max(4000));

const createTaskListInput = z.object({
  name: z.string().min(1).max(200),
});

const updateTaskListInput = z.object({
  id: idString,
  name: z.string().min(1).max(200),
});

const deleteTaskListInput = z.object({ id: idString });

const reorderTaskListsInput = z.object({
  ids: z.array(idString).min(1),
});

const createTaskInput = z.object({
  listId: idString,
  description: z.string().min(1).max(4000),
  status: statusEnum.optional(),
  dueDate: z.string().optional().nullable(),
  durationMinutes: z.number().int().min(1).max(60 * 24 * 30).optional().nullable(),
  tags: z.array(z.string().max(80)).optional(),
  meta: metaInput.optional().nullable(),
  parentTaskId: z.string().optional().nullable(),
  targetIndex: z.number().int().min(0).optional(),
});

const updateTaskInput = z.object({
  id: idString,
  description: z.string().min(1).max(4000).optional(),
  status: statusEnum.optional(),
  dueDate: z.string().optional().nullable(),
  durationMinutes: z.number().int().min(1).max(60 * 24 * 30).optional().nullable(),
  tags: z.array(z.string().max(80)).optional(),
  meta: metaInput.optional().nullable(),
});

const deleteTaskInput = z.object({ id: idString });

const moveTaskInput = z.object({
  taskId: idString,
  targetParentTaskId: z.string().optional().nullable(),
  targetIndex: z.number().int().min(0),
});

const normalizeTags = (tags: string[] | undefined): string[] => {
  if (!tags) return [];
  const deduped = new Set<string>();
  for (const tag of tags) {
    const normalized = tag.trim();
    if (!normalized) continue;
    deduped.add(normalized);
  }
  return [...deduped];
};

const parseDueDate = (value: string | null | undefined): Date | null => {
  if (value === undefined) return null;
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("Invalid dueDate format; expected YYYY-MM-DD");
  }
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid dueDate");
  }
  return parsed;
};

const normalizeMeta = (
  input: Record<string, string> | null | undefined
): Record<string, string> | null => {
  if (input === undefined || input === null) return null;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.trim();
    if (!normalizedKey) continue;
    result[normalizedKey] = value.trim();
  }
  return Object.keys(result).length > 0 ? result : null;
};

const toPrismaMeta = (meta: Record<string, string> | null) =>
  meta ? (meta as Prisma.InputJsonValue) : Prisma.DbNull;

const clampIndex = (index: number, size: number) => Math.max(0, Math.min(index, size));

const ensureParentInList = async (
  listId: string,
  parentTaskId: string | null
): Promise<void> => {
  if (!parentTaskId) return;
  const parent = await prisma.taskItem.findUnique({
    where: { id: parentTaskId },
    select: { id: true, listId: true },
  });
  if (!parent || parent.listId !== listId) {
    throw new Error("Invalid parent task");
  }
};

const assertNoCycle = async (
  taskId: string,
  targetParentTaskId: string | null,
  listId: string
) => {
  let cursor = targetParentTaskId;
  while (cursor) {
    if (cursor === taskId) throw new Error("Cannot parent a task under itself");
    const row = await prisma.taskItem.findUnique({
      where: { id: cursor },
      select: { id: true, listId: true, parentTaskId: true },
    });
    if (!row || row.listId !== listId) {
      throw new Error("Invalid parent task");
    }
    cursor = row.parentTaskId;
  }
};

const normalizeListSortOrders = async () => {
  const lists = await prisma.taskList.findMany({
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  for (const [index, list] of lists.entries()) {
    await prisma.taskList.update({
      where: { id: list.id },
      data: { sortOrder: index },
      select: { id: true },
    });
  }
};

export const createTaskList = action(
  async (payload: z.infer<typeof createTaskListInput>) => {
    "use server";
    const input = createTaskListInput.parse(payload);
    const count = await prisma.taskList.count();
    const created = await prisma.taskList.create({
      data: {
        name: input.name.trim(),
        sortOrder: count,
      },
      select: { id: true },
    });
    return created;
  },
  "task-list-create"
);

export const updateTaskList = action(
  async (payload: z.infer<typeof updateTaskListInput>) => {
    "use server";
    const input = updateTaskListInput.parse(payload);
    const updated = await prisma.taskList.update({
      where: { id: input.id },
      data: { name: input.name.trim() },
      select: { id: true, updatedAt: true },
    });
    return { id: updated.id, updatedAt: updated.updatedAt.toISOString() };
  },
  "task-list-update"
);

export const deleteTaskList = action(
  async (payload: z.infer<typeof deleteTaskListInput>) => {
    "use server";
    const input = deleteTaskListInput.parse(payload);

    await prisma.taskList.delete({ where: { id: input.id }, select: { id: true } });
    await normalizeListSortOrders();

    return { ok: true };
  },
  "task-list-delete"
);

export const reorderTaskLists = action(
  async (payload: z.infer<typeof reorderTaskListsInput>) => {
    "use server";
    const input = reorderTaskListsInput.parse(payload);

    await prisma.$transaction(
      input.ids.map((id, index) =>
        prisma.taskList.updateMany({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    await normalizeListSortOrders();

    return { ok: true };
  },
  "task-list-reorder"
);

export const createTask = action(
  async (payload: z.infer<typeof createTaskInput>) => {
    "use server";
    const input = createTaskInput.parse(payload);
    const parentTaskId = input.parentTaskId?.trim() || null;
    await ensureParentInList(input.listId, parentTaskId);

    const dueDate = parseDueDate(input.dueDate);
    const tags = normalizeTags(input.tags);
    const meta = normalizeMeta(input.meta);

    const created = await prisma.$transaction(async (tx) => {
      const siblings = await tx.taskItem.findMany({
        where: { listId: input.listId, parentTaskId },
        select: { id: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });

      const targetIndex = clampIndex(input.targetIndex ?? siblings.length, siblings.length);

      const createdTask = await tx.taskItem.create({
        data: {
          listId: input.listId,
          description: input.description.trim(),
          status: input.status ?? "waiting",
          dueDate,
          durationMinutes: input.durationMinutes ?? null,
          tags,
          meta: toPrismaMeta(meta),
          parentTaskId,
          sortOrder: siblings.length,
        },
        select: { id: true },
      });

      const orderedIds = siblings.map((item) => item.id);
      orderedIds.splice(targetIndex, 0, createdTask.id);

      for (const [index, id] of orderedIds.entries()) {
        await tx.taskItem.update({
          where: { id },
          data: { sortOrder: index, parentTaskId },
          select: { id: true },
        });
      }

      return createdTask;
    });

    return created;
  },
  "task-create"
);

export const updateTask = action(
  async (payload: z.infer<typeof updateTaskInput>) => {
    "use server";
    const input = updateTaskInput.parse(payload);

    const existing = await prisma.taskItem.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existing) throw new Error("Task not found");

    const updates: {
      description?: string;
      status?: z.infer<typeof statusEnum>;
      dueDate?: Date | null;
      durationMinutes?: number | null;
      tags?: string[];
      meta?: Prisma.InputJsonValue | Prisma.NullTypes.DbNull;
    } = {};

    if (input.description !== undefined) updates.description = input.description.trim();
    if (input.status !== undefined) updates.status = input.status;
    if (input.dueDate !== undefined) updates.dueDate = parseDueDate(input.dueDate);
    if (input.durationMinutes !== undefined) {
      updates.durationMinutes = input.durationMinutes;
    }
    if (input.tags !== undefined) updates.tags = normalizeTags(input.tags);
    if (input.meta !== undefined) {
      updates.meta = toPrismaMeta(normalizeMeta(input.meta));
    }

    const updated = await prisma.taskItem.update({
      where: { id: input.id },
      data: updates,
      select: { id: true, updatedAt: true },
    });

    return { id: updated.id, updatedAt: updated.updatedAt.toISOString() };
  },
  "task-update"
);

export const deleteTask = action(
  async (payload: z.infer<typeof deleteTaskInput>) => {
    "use server";
    const input = deleteTaskInput.parse(payload);

    await prisma.$transaction(async (tx) => {
      const target = await tx.taskItem.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          listId: true,
          parentTaskId: true,
          sortOrder: true,
        },
      });
      if (!target) throw new Error("Task not found");

      const [siblings, children] = await Promise.all([
        tx.taskItem.findMany({
          where: {
            listId: target.listId,
            parentTaskId: target.parentTaskId,
            id: { not: target.id },
          },
          select: { id: true, sortOrder: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        }),
        tx.taskItem.findMany({
          where: {
            parentTaskId: target.id,
          },
          select: { id: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        }),
      ]);

      const before = siblings.filter((item) => item.sortOrder < target.sortOrder);
      const after = siblings.filter((item) => item.sortOrder >= target.sortOrder);
      const mergedIds = [
        ...before.map((item) => item.id),
        ...children.map((item) => item.id),
        ...after.map((item) => item.id),
      ];

      for (const [index, id] of mergedIds.entries()) {
        await tx.taskItem.update({
          where: { id },
          data: {
            parentTaskId: target.parentTaskId,
            sortOrder: index,
          },
          select: { id: true },
        });
      }

      await tx.taskItem.delete({ where: { id: target.id }, select: { id: true } });
    });

    return { ok: true };
  },
  "task-delete"
);

export const moveTask = action(
  async (payload: z.infer<typeof moveTaskInput>) => {
    "use server";
    const input = moveTaskInput.parse(payload);
    const targetParentTaskId = input.targetParentTaskId?.trim() || null;

    const moving = await prisma.taskItem.findUnique({
      where: { id: input.taskId },
      select: { id: true, listId: true, parentTaskId: true },
    });
    if (!moving) throw new Error("Task not found");

    if (targetParentTaskId) {
      const targetParent = await prisma.taskItem.findUnique({
        where: { id: targetParentTaskId },
        select: { id: true, listId: true },
      });
      if (!targetParent || targetParent.listId !== moving.listId) {
        throw new Error("Invalid target parent");
      }
    }

    await assertNoCycle(moving.id, targetParentTaskId, moving.listId);

    await prisma.$transaction(async (tx) => {
      const sameParent = moving.parentTaskId === targetParentTaskId;

      if (sameParent) {
        const siblings = await tx.taskItem.findMany({
          where: {
            listId: moving.listId,
            parentTaskId: moving.parentTaskId,
            id: { not: moving.id },
          },
          select: { id: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });

        const orderedIds = siblings.map((item) => item.id);
        const targetIndex = clampIndex(input.targetIndex, orderedIds.length);
        orderedIds.splice(targetIndex, 0, moving.id);

        for (const [index, id] of orderedIds.entries()) {
          await tx.taskItem.update({
            where: { id },
            data: {
              parentTaskId: targetParentTaskId,
              sortOrder: index,
            },
            select: { id: true },
          });
        }
        return;
      }

      const sourceSiblings = await tx.taskItem.findMany({
        where: {
          listId: moving.listId,
          parentTaskId: moving.parentTaskId,
          id: { not: moving.id },
        },
        select: { id: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });

      for (const [index, item] of sourceSiblings.entries()) {
        await tx.taskItem.update({
          where: { id: item.id },
          data: { sortOrder: index },
          select: { id: true },
        });
      }

      const targetSiblings = await tx.taskItem.findMany({
        where: {
          listId: moving.listId,
          parentTaskId: targetParentTaskId,
          id: { not: moving.id },
        },
        select: { id: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });

      const orderedIds = targetSiblings.map((item) => item.id);
      const targetIndex = clampIndex(input.targetIndex, orderedIds.length);
      orderedIds.splice(targetIndex, 0, moving.id);

      for (const [index, id] of orderedIds.entries()) {
        await tx.taskItem.update({
          where: { id },
          data: {
            parentTaskId: targetParentTaskId,
            sortOrder: index,
          },
          select: { id: true },
        });
      }
    });

    return { ok: true };
  },
  "task-move"
);
