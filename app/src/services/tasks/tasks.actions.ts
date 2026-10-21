import { action } from "@solidjs/router";
import type { z } from "zod";
import * as store from "~/server/tasks/task-store";

// Router actions for the Tasks page. The logic lives in
// server/tasks/task-store.ts so the MCP connector writes the same way.

export const createTaskList = action(
  async (payload: z.infer<typeof store.createTaskListInput>) => {
    "use server";
    return store.createTaskList(payload);
  },
  "task-list-create",
);

export const updateTaskList = action(
  async (payload: z.infer<typeof store.updateTaskListInput>) => {
    "use server";
    return store.updateTaskList(payload);
  },
  "task-list-update",
);

export const deleteTaskList = action(
  async (payload: z.infer<typeof store.deleteTaskListInput>) => {
    "use server";
    return store.deleteTaskList(payload);
  },
  "task-list-delete",
);

export const reorderTaskLists = action(
  async (payload: z.infer<typeof store.reorderTaskListsInput>) => {
    "use server";
    return store.reorderTaskLists(payload);
  },
  "task-list-reorder",
);

export const createTask = action(
  async (payload: z.infer<typeof store.createTaskInput>) => {
    "use server";
    return store.createTask(payload);
  },
  "task-create",
);

export const updateTask = action(
  async (payload: z.infer<typeof store.updateTaskInput>) => {
    "use server";
    return store.updateTask(payload);
  },
  "task-update",
);

export const deleteTask = action(
  async (payload: z.infer<typeof store.deleteTaskInput>) => {
    "use server";
    return store.deleteTask(payload);
  },
  "task-delete",
);

export const moveTask = action(
  async (payload: z.infer<typeof store.moveTaskInput>) => {
    "use server";
    return store.moveTask(payload);
  },
  "task-move",
);

export const moveTaskToList = action(
  async (payload: z.infer<typeof store.moveTaskToListInput>) => {
    "use server";
    return store.moveTaskToList(payload);
  },
  "task-move-to-list",
);
