export const TASK_STATUSES = [
  "waiting",
  "started",
  "deferred",
  "complete",
  "cancelled",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskListItem = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** fetchTaskLists: open (not complete/cancelled) tasks; fetchTaskListById: all tasks. */
  taskCount: number;
};

export type TaskItem = {
  id: string;
  listId: string;
  description: string;
  status: TaskStatus;
  dueDate: string | null;
  durationMinutes: number | null;
  tags: string[];
  meta: Record<string, string> | null;
  parentTaskId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
