import type { TaskItem } from "~/services/tasks/tasks.service";
import { isDoneStatus } from "./taskFormat";

const bySortOrder = (a: TaskItem, b: TaskItem) => {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.createdAt.localeCompare(b.createdAt);
};

/** Sorted children for every parent id; `null` holds the roots. */
export const groupChildren = (items: TaskItem[]) => {
  const map = new Map<string | null, TaskItem[]>();
  const ids = new Set(items.map((task) => task.id));
  for (const task of items) {
    // Orphans (parent missing from this list) render as roots.
    const key = task.parentTaskId && ids.has(task.parentTaskId) ? task.parentTaskId : null;
    const rows = map.get(key) ?? [];
    rows.push(task);
    map.set(key, rows);
  }
  for (const rows of map.values()) rows.sort(bySortOrder);
  return map;
};

const reindex = (rows: TaskItem[]) => rows.forEach((task, index) => (task.sortOrder = index));

export const moveTaskLocally = (
  items: TaskItem[],
  taskId: string,
  targetParentTaskId: string | null,
  targetIndex: number
) => {
  const movedTask = items.find((task) => task.id === taskId);
  if (!movedTask) return items;

  const nextItems = items.map((task) =>
    task.id === taskId ? { ...task, parentTaskId: targetParentTaskId } : { ...task }
  );
  const sourceParentTaskId = movedTask.parentTaskId;
  const siblingsOf = (parentId: string | null) =>
    nextItems
      .filter((task) => task.parentTaskId === parentId && task.id !== taskId)
      .sort(bySortOrder);

  reindex(siblingsOf(sourceParentTaskId));

  const destination = siblingsOf(targetParentTaskId);
  const adjustedTargetIndex =
    sourceParentTaskId === targetParentTaskId && movedTask.sortOrder < targetIndex
      ? targetIndex - 1
      : targetIndex;
  const insertAt = Math.max(0, Math.min(adjustedTargetIndex, destination.length));
  const movedNext = nextItems.find((task) => task.id === taskId)!;
  destination.splice(insertAt, 0, movedNext);
  reindex(destination);

  return nextItems;
};

export const insertTaskLocally = (items: TaskItem[], task: TaskItem, targetIndex: number) => {
  const nextItems = items.map((item) => ({ ...item }));
  const siblings = nextItems
    .filter((item) => item.parentTaskId === task.parentTaskId)
    .sort(bySortOrder);
  const inserted = { ...task };
  siblings.splice(Math.max(0, Math.min(targetIndex, siblings.length)), 0, inserted);
  reindex(siblings);
  return [...nextItems, inserted];
};

/** Mirrors the server: children of a deleted task move up into its slot. */
export const deleteTaskLocally = (items: TaskItem[], taskId: string) => {
  const target = items.find((task) => task.id === taskId);
  if (!target) return items;
  const nextItems = items.filter((task) => task.id !== taskId).map((task) => ({ ...task }));
  const siblings = nextItems
    .filter((task) => task.parentTaskId === target.parentTaskId)
    .sort(bySortOrder);
  const children = nextItems.filter((task) => task.parentTaskId === taskId).sort(bySortOrder);
  const before = siblings.filter((task) => task.sortOrder < target.sortOrder);
  const after = siblings.filter((task) => task.sortOrder >= target.sortOrder);
  const merged = [...before, ...children, ...after];
  merged.forEach((task, index) => {
    task.parentTaskId = target.parentTaskId;
    task.sortOrder = index;
  });
  return nextItems;
};

export const isDescendantOf = (
  tasksById: Map<string, TaskItem>,
  taskId: string,
  ancestorId: string
) => {
  let cursor = tasksById.get(taskId)?.parentTaskId ?? null;
  while (cursor) {
    if (cursor === ancestorId) return true;
    cursor = tasksById.get(cursor)?.parentTaskId ?? null;
  }
  return false;
};

/** True when the task or any descendant is still open. */
export const buildOpenIndex = (children: Map<string | null, TaskItem[]>) => {
  const cache = new Map<string, boolean>();
  const hasOpen = (task: TaskItem): boolean => {
    const cached = cache.get(task.id);
    if (cached !== undefined) return cached;
    const result =
      !isDoneStatus(task.status) || (children.get(task.id) ?? []).some(hasOpen);
    cache.set(task.id, result);
    return result;
  };
  return hasOpen;
};
