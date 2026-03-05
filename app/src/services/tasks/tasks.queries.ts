import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import type { TaskItem, TaskListItem } from "./tasks.types";

const toDateOnlyIso = (value: Date | null): string | null => {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
};

const mapTaskList = (row: {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  _count: { tasks: number };
}): TaskListItem => ({
  id: row.id,
  name: row.name,
  sortOrder: row.sortOrder,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  taskCount: row._count.tasks,
});

const mapTaskItem = (row: {
  id: string;
  listId: string;
  description: string;
  status: string;
  dueDate: Date | null;
  durationMinutes: number | null;
  tags: string[];
  meta: unknown;
  parentTaskId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): TaskItem => ({
  id: row.id,
  listId: row.listId,
  description: row.description,
  status: row.status as TaskItem["status"],
  dueDate: toDateOnlyIso(row.dueDate),
  durationMinutes: row.durationMinutes,
  tags: row.tags,
  meta:
    row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
      ? (row.meta as Record<string, string>)
      : null,
  parentTaskId: row.parentTaskId,
  sortOrder: row.sortOrder,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const fetchTaskLists = query(
  async (_input?: { refresh?: number }): Promise<TaskListItem[]> => {
  "use server";
  const rows = await prisma.taskList.findMany({
    include: {
      _count: {
        select: {
          tasks: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return rows.map(mapTaskList);
  },
  "task-lists"
);

export const fetchTaskListById = query(
  async (input: { listId: string }): Promise<TaskListItem | null> => {
    "use server";
    const listId = String(input?.listId || "").trim();
    if (!listId) return null;

    const row = await prisma.taskList.findUnique({
      where: { id: listId },
      include: {
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    return row ? mapTaskList(row) : null;
  },
  "task-list-by-id"
);

export const fetchTaskTree = query(
  async (input: { listId: string; refresh?: number }): Promise<TaskItem[]> => {
    "use server";
    const listId = String(input?.listId || "").trim();
    if (!listId) return [];

    const rows = await prisma.taskItem.findMany({
      where: { listId },
      orderBy: [
        { parentTaskId: "asc" },
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
    });

    return rows.map(mapTaskItem);
  },
  "task-tree"
);
