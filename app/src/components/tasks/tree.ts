import type { TaskItem } from "~/services/tasks/tasks.service";

export type TaskTreeNode = {
  task: TaskItem;
  children: TaskTreeNode[];
};

export const buildTaskTree = (items: TaskItem[]): TaskTreeNode[] => {
  const byId = new Map<string, TaskTreeNode>();
  const roots: TaskTreeNode[] = [];

  for (const item of [...items].sort((a, b) => {
    if ((a.parentTaskId || "") !== (b.parentTaskId || "")) {
      return (a.parentTaskId || "").localeCompare(b.parentTaskId || "");
    }
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.createdAt.localeCompare(b.createdAt);
  })) {
    byId.set(item.id, { task: item, children: [] });
  }

  for (const item of items) {
    const node = byId.get(item.id);
    if (!node) continue;
    const parentId = item.parentTaskId;
    if (!parentId) {
      roots.push(node);
      continue;
    }

    const parent = byId.get(parentId);
    if (!parent) {
      roots.push(node);
      continue;
    }
    parent.children.push(node);
  }

  const sortNodes = (nodes: TaskTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.task.sortOrder !== b.task.sortOrder) {
        return a.task.sortOrder - b.task.sortOrder;
      }
      return a.task.createdAt.localeCompare(b.task.createdAt);
    });
    for (const node of nodes) sortNodes(node.children);
  };

  sortNodes(roots);
  return roots;
};
