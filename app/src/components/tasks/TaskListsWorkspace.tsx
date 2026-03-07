import { useAction } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  Show,
} from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import {
  createTask,
  createTaskList,
  deleteTask,
  deleteTaskList,
  fetchTaskLists,
  fetchTaskTree,
  moveTask,
  updateTask,
  updateTaskList,
  type TaskItem,
} from "~/services/tasks/tasks.service";
import { TaskEditorDialog } from "./TaskEditorDialog";
import { TaskListEditorDialog } from "./TaskListEditorDialog";
import { TaskListSelector } from "./TaskListSelector";
import { TaskTree } from "./TaskTree";
import { buildTaskTree } from "./tree";

type DropKind = "before" | "inside" | "after";

export const TaskListsWorkspace = () => {
  const [listsRefreshNonce, setListsRefreshNonce] = createSignal(0);
  const [tasksRefreshNonce, setTasksRefreshNonce] = createSignal(0);
  const [selectedListId, setSelectedListId] = createSignal<string | null>(null);
  const [optimisticListNames, setOptimisticListNames] = createSignal<Map<string, string>>(
    new Map()
  );

  const [listDialogOpen, setListDialogOpen] = createSignal(false);

  const [taskDialogOpen, setTaskDialogOpen] = createSignal(false);
  const [taskDialogMode, setTaskDialogMode] = createSignal<"create" | "edit">("create");
  const [editingTask, setEditingTask] = createSignal<TaskItem | null>(null);
  const [taskDialogParentTaskId, setTaskDialogParentTaskId] = createSignal<string | null>(null);

  const [draggingTaskId, setDraggingTaskId] = createSignal<string | null>(null);
  const [activeDrop, setActiveDrop] = createSignal<
    { taskId: string; kind: DropKind } | null
  >(null);
  const [expandedIds, setExpandedIds] = createSignal<Set<string>>(new Set());

  const runCreateList = useAction(createTaskList);
  const runUpdateList = useAction(updateTaskList);
  const runDeleteList = useAction(deleteTaskList);
  const runCreateTask = useAction(createTask);
  const runUpdateTask = useAction(updateTask);
  const runDeleteTask = useAction(deleteTask);
  const runMoveTask = useAction(moveTask);

  const refreshLists = () => setListsRefreshNonce((value) => value + 1);
  const refreshTasks = () => setTasksRefreshNonce((value) => value + 1);

  const [lists] = createResource(
    () => listsRefreshNonce(),
    async (refresh) => fetchTaskLists({ refresh })
  );

  const [tasks] = createResource(
    () => ({ listId: selectedListId(), refresh: tasksRefreshNonce() }),
    async (source) => {
      if (!source.listId) return [];
      return fetchTaskTree({ listId: source.listId, refresh: source.refresh });
    }
  );

  createEffect(() => {
    const listItems = lists.latest ?? lists() ?? [];
    const optimisticNames = optimisticListNames();

    if (optimisticNames.size > 0 && listItems.length > 0) {
      let changed = false;
      for (const list of listItems) {
        if (optimisticNames.get(list.id) === list.name) {
          changed = true;
          break;
        }
      }

      if (changed) {
        setOptimisticListNames((current) => {
          const next = new Map(current);
          for (const list of listItems) {
            if (next.get(list.id) === list.name) {
              next.delete(list.id);
            }
          }
          return next;
        });
      }
    }

    if (listItems.length === 0) {
      setSelectedListId(null);
      return;
    }

    const selected = selectedListId();
    if (!selected || !listItems.some((list) => list.id === selected)) {
      setSelectedListId(listItems[0].id);
    }
  });

  const mergedLists = createMemo(() => {
    const listItems = lists.latest ?? lists() ?? [];
    const optimisticNames = optimisticListNames();
    if (optimisticNames.size === 0) return listItems;

    return listItems.map((list) => {
      const optimisticName = optimisticNames.get(list.id);
      if (!optimisticName) return list;
      return { ...list, name: optimisticName };
    });
  });

  const selectedList = createMemo(() => {
    const listItems = mergedLists();
    return listItems.find((list) => list.id === selectedListId()) ?? null;
  });

  const taskItems = createMemo(() => tasks.latest ?? tasks() ?? []);
  const tree = createMemo(() => buildTaskTree(taskItems()));

  const childrenByParent = createMemo(() => {
    const map = new Map<string | null, TaskItem[]>();
    for (const task of taskItems()) {
      const key = task.parentTaskId;
      const existing = map.get(key) ?? [];
      existing.push(task);
      map.set(key, existing);
    }
    for (const [key, rows] of map.entries()) {
      rows.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.createdAt.localeCompare(b.createdAt);
      });
      map.set(key, rows);
    }
    return map;
  });

  const openCreateListDialog = () => {
    setListDialogOpen(true);
  };

  const openCreateTaskDialog = () => {
    setTaskDialogMode("create");
    setEditingTask(null);
    setTaskDialogParentTaskId(null);
    setTaskDialogOpen(true);
  };

  const openEditTaskDialog = (task: TaskItem) => {
    setTaskDialogMode("edit");
    setEditingTask(task);
    setTaskDialogParentTaskId(task.parentTaskId);
    setTaskDialogOpen(true);
  };

  const toggleExpanded = (taskId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      console.info(
        `[tasks-tree] expanded set updated toggledTaskId=${taskId} expandedNow=${next.has(taskId)} size=${next.size}`
      );
      return next;
    });
  };

  createEffect(() => {
    const ids = [...expandedIds()].sort();
    console.info(
      `[tasks-tree] expanded snapshot ids=${ids.length > 0 ? ids.join(",") : "(none)"}`
    );
  });

  const onDrop = async (
    targetTaskId: string,
    kind: DropKind,
    draggedTaskId: string | null
  ) => {
    const movingId = draggedTaskId || draggingTaskId();
    if (!movingId || movingId === targetTaskId) return;

    const all = taskItems();
    const target = all.find((task) => task.id === targetTaskId);
    if (!target) return;

    const siblingsMap = childrenByParent();
    let targetParentTaskId: string | null = null;
    let targetIndex = 0;

    if (kind === "inside") {
      targetParentTaskId = target.id;
      targetIndex = (siblingsMap.get(target.id) || []).length;
      setExpandedIds((current) => new Set(current).add(target.id));
    } else {
      targetParentTaskId = target.parentTaskId;
      const siblings = siblingsMap.get(target.parentTaskId) || [];
      const index = siblings.findIndex((item) => item.id === target.id);
      if (index < 0) return;
      targetIndex = kind === "before" ? index : index + 1;
    }

    await runMoveTask({
      taskId: movingId,
      targetParentTaskId,
      targetIndex,
    });

    setDraggingTaskId(null);
    setActiveDrop(null);
    refreshTasks();
  };

  const onDropRoot = async (draggedTaskId: string | null) => {
    const movingId = draggedTaskId || draggingTaskId();
    if (!movingId) return;

    const roots = childrenByParent().get(null) || [];
    await runMoveTask({
      taskId: movingId,
      targetParentTaskId: null,
      targetIndex: roots.length,
    });

    setDraggingTaskId(null);
    setActiveDrop(null);
    refreshTasks();
  };

  return (
    <Box
      display="flex"
      flexDirection={{ base: "column", lg: "row" }}
      alignItems="stretch"
      gap="4"
      minH="0"
      flex="1"
      overflow="hidden"
      data-testid="tasks-page"
    >
      <Box
        flex={{ lg: "0 0 360px" }}
        w={{ base: "full", lg: "auto" }}
        minW={{ lg: "280px" }}
        maxW={{ base: "100%", lg: "420px" }}
        borderWidth="1px"
        borderColor="border"
        borderRadius="lg"
        p="3"
        minH="0"
        maxH={{ base: "40vh", lg: "none" }}
        overflow="hidden"
        display="flex"
        flexDirection="column"
      >
        <TaskListSelector
          lists={mergedLists()}
          selectedListId={selectedListId()}
          onSelect={setSelectedListId}
          onCreate={openCreateListDialog}
          onRename={(list, nextName) => {
            setOptimisticListNames((current) => {
              const next = new Map(current);
              next.set(list.id, nextName);
              return next;
            });

            void runUpdateList({ id: list.id, name: nextName })
              .catch((error) => {
                console.error("[tasks-lists] rename failed", {
                  listId: list.id,
                  nextName,
                  error,
                });
              })
              .finally(() => {
                refreshLists();
              });
          }}
          onDelete={async (list) => {
            await runDeleteList({ id: list.id });
            refreshLists();
            refreshTasks();
          }}
        />
      </Box>

      <Box
        flex="1"
        minW="0"
        w={{ base: "full", lg: "auto" }}
        borderWidth="1px"
        borderColor="border"
        borderRadius="lg"
        p="3"
        minH="0"
        display="flex"
        flexDirection="column"
      >
        <HStack justifyContent="space-between" alignItems="center" mb="3">
          <Stack gap="0">
            <Text fontSize="lg" fontWeight="semibold">
              {selectedList()?.name || "Task List"}
            </Text>
            <Text color="fg.muted" fontSize="sm">
              {taskItems().length} task{taskItems().length === 1 ? "" : "s"}
            </Text>
          </Stack>

          <Button
            onClick={openCreateTaskDialog}
            disabled={!selectedListId()}
            data-testid="task-create-button"
          >
            New Task
          </Button>
        </HStack>

        <Show
          when={selectedListId()}
          fallback={<Box color="fg.muted">Create a list to start tracking tasks.</Box>}
        >
          <TaskTree
            nodes={tree()}
            expandedIds={expandedIds()}
            draggingTaskId={draggingTaskId()}
            activeDrop={activeDrop()}
            onToggleExpanded={toggleExpanded}
            onDragStart={(taskId) => {
              setDraggingTaskId(taskId);
              setActiveDrop(null);
            }}
            onDragEnd={() => {
              setDraggingTaskId(null);
              setActiveDrop(null);
            }}
            onDragEnterTarget={(taskId, kind) => setActiveDrop({ taskId, kind })}
            onDrop={(taskId, kind, draggedTaskId) =>
              void onDrop(taskId, kind, draggedTaskId)}
            onEdit={openEditTaskDialog}
            onDropRoot={(draggedTaskId) => void onDropRoot(draggedTaskId)}
            onDragEnterRoot={() => setActiveDrop(null)}
          />
        </Show>
      </Box>

      <TaskListEditorDialog
        open={listDialogOpen()}
        onClose={() => setListDialogOpen(false)}
        onSubmit={async (name) => {
          await runCreateList({ name });
          refreshLists();
        }}
      />

      <TaskEditorDialog
        open={taskDialogOpen()}
        mode={taskDialogMode()}
        task={editingTask()}
        parentTaskId={taskDialogParentTaskId()}
        parentOptions={taskItems()
          .filter((task) => task.id !== editingTask()?.id)
          .map((task) => ({ id: task.id, label: task.description.slice(0, 80) }))}
        onClose={() => setTaskDialogOpen(false)}
        onSubmit={async (value) => {
          const listId = selectedListId();
          if (!listId) return;

          if (taskDialogMode() === "create") {
            await runCreateTask({
              listId,
              description: value.description,
              status: value.status,
              dueDate: value.dueDate,
              durationMinutes: value.durationMinutes,
              tags: value.tags,
              meta: value.meta,
              parentTaskId: value.parentTaskId,
            });
            if (value.parentTaskId) {
              setExpandedIds((current) => new Set(current).add(value.parentTaskId!));
            }
          } else if (editingTask()) {
            await runUpdateTask({
              id: editingTask()!.id,
              description: value.description,
              status: value.status,
              dueDate: value.dueDate,
              durationMinutes: value.durationMinutes,
              tags: value.tags,
              meta: value.meta,
            });

            if (value.parentTaskId !== editingTask()!.parentTaskId) {
              const siblings = childrenByParent().get(value.parentTaskId) || [];
              await runMoveTask({
                taskId: editingTask()!.id,
                targetParentTaskId: value.parentTaskId,
                targetIndex: siblings.length,
              });
            }
          }

          refreshTasks();
          refreshLists();
        }}
        onDelete={
          taskDialogMode() === "edit" && editingTask()
            ? async () => {
                await runDeleteTask({ id: editingTask()!.id });
                refreshTasks();
                refreshLists();
              }
            : undefined
        }
      />
    </Box>
  );
};
