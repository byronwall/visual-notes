import { useSearchParams } from "@solidjs/router";
import { createMemo, createResource, createSignal } from "solid-js";
import {
  fetchTaskLists,
  fetchTaskTree,
  type TaskItem,
  type TaskListItem,
} from "~/services/tasks/tasks.service";
import { isDoneStatus } from "./taskFormat";
import { buildOpenIndex, groupChildren } from "./taskTreeOps";

/**
 * Lists, the selected list (persisted as `?list=`), its tasks, and the
 * derived display tree. Done tasks without open descendants are hidden unless
 * `?done=1`; tasks finished during this visit stay put until the list changes.
 */
export const createTaskData = () => {
  const [searchParams, setSearchParams] = useSearchParams<{ list?: string; done?: string }>();
  const [listsNonce, setListsNonce] = createSignal(0);
  const [tasksNonce, setTasksNonce] = createSignal(0);
  const [recentlyDone, setRecentlyDone] = createSignal<Set<string>>(new Set());

  const [lists, { mutate: mutateLists }] = createResource(
    () => listsNonce(),
    (refresh) => fetchTaskLists({ refresh })
  );

  const mergedLists = createMemo<TaskListItem[]>(() => lists.latest ?? []);

  const selectedListId = createMemo(() => {
    const items = mergedLists();
    const requested = searchParams.list;
    if (requested && items.some((list) => list.id === requested)) return requested;
    return items[0]?.id ?? null;
  });

  const selectedList = createMemo(
    () => mergedLists().find((list) => list.id === selectedListId()) ?? null
  );

  const [tasks, { mutate: mutateTasks }] = createResource(
    () => {
      const listId = selectedListId();
      return listId ? { listId, refresh: tasksNonce() } : false;
    },
    (source) => fetchTaskTree(source)
  );

  const taskItems = createMemo<TaskItem[]>(() =>
    selectedListId() ? (tasks.latest ?? []) : []
  );
  const tasksById = createMemo(() => new Map(taskItems().map((task) => [task.id, task])));
  const children = createMemo(() => groupChildren(taskItems()));
  const hasOpen = createMemo(() => buildOpenIndex(children()));

  const showDone = () => searchParams.done === "1";
  const setShowDone = (value: boolean) => {
    setRecentlyDone(new Set<string>());
    setSearchParams({ done: value ? "1" : undefined }, { replace: true });
  };

  const isVisibleInActive = (task: TaskItem) =>
    !isDoneStatus(task.status) || recentlyDone().has(task.id) || hasOpen()(task);

  const visibleChildIds = (parentTaskId: string | null) => {
    const rows = children().get(parentTaskId) ?? [];
    if (parentTaskId === null) {
      return rows.filter(isVisibleInActive).map((task) => task.id);
    }
    return rows.filter((task) => showDone() || isVisibleInActive(task)).map((task) => task.id);
  };

  const doneRootIds = createMemo(() =>
    (children().get(null) ?? [])
      .filter((task) => !isVisibleInActive(task))
      .map((task) => task.id)
  );

  const hiddenDoneCount = createMemo(
    () => taskItems().filter((task) => isDoneStatus(task.status) && !recentlyDone().has(task.id)).length
  );

  const progress = createMemo(() => {
    const result = new Map<string, { done: number; total: number }>();
    const walk = (task: TaskItem): { done: number; total: number } => {
      const cached = result.get(task.id);
      if (cached) return cached;
      const totals = { done: 0, total: 0 };
      for (const child of children().get(task.id) ?? []) {
        const nested = walk(child);
        totals.total += 1 + nested.total;
        totals.done += (isDoneStatus(child.status) ? 1 : 0) + nested.done;
      }
      result.set(task.id, totals);
      return totals;
    };
    for (const task of taskItems()) walk(task);
    return result;
  });

  const selectList = (listId: string) => {
    setRecentlyDone(new Set<string>());
    setSearchParams({ list: listId }, { replace: true });
  };

  const markRecentlyDone = (taskId: string) =>
    setRecentlyDone((current) => new Set(current).add(taskId));

  return {
    lists,
    mergedLists,
    mutateLists,
    selectedListId,
    selectedList,
    tasks,
    taskItems,
    tasksById,
    children,
    mutateTasks,
    showDone,
    setShowDone,
    visibleChildIds,
    doneRootIds,
    hiddenDoneCount,
    progress,
    selectList,
    markRecentlyDone,
    refreshLists: () => setListsNonce((value) => value + 1),
    refreshTasks: () => setTasksNonce((value) => value + 1),
  };
};

export type TaskData = ReturnType<typeof createTaskData>;
