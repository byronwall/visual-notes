import { useAction } from "@solidjs/router";
import {
  batch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onMount,
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
import { formatTaskTitle, parseTaskTitle } from "./taskTitle";
import { buildTaskTree } from "./tree";

type DropKind = "before" | "inside" | "after";
type MoveDirection = "up" | "down" | "left" | "right";

type InlineCreateState = {
  parentTaskId: string | null;
  targetIndex: number;
  value: string;
  saving: boolean;
  error: string | null;
};

const moveTaskLocally = (
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
  const sourceSiblings = nextItems
    .filter((task) => task.parentTaskId === sourceParentTaskId && task.id !== taskId)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.createdAt.localeCompare(b.createdAt);
    });

  sourceSiblings.forEach((task, index) => {
    task.sortOrder = index;
  });

  const destinationSiblings = nextItems
    .filter((task) => task.parentTaskId === targetParentTaskId && task.id !== taskId)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.createdAt.localeCompare(b.createdAt);
    });

  const movingWithinSameParent = sourceParentTaskId === targetParentTaskId;
  const adjustedTargetIndex =
    movingWithinSameParent && movedTask.sortOrder < targetIndex
      ? targetIndex - 1
      : targetIndex;
  const insertAt = Math.max(0, Math.min(adjustedTargetIndex, destinationSiblings.length));
  const movedNext = nextItems.find((task) => task.id === taskId);
  if (!movedNext) return items;
  destinationSiblings.splice(insertAt, 0, movedNext);
  destinationSiblings.forEach((task, index) => {
    task.sortOrder = index;
  });

  return nextItems;
};

const isTextEntryTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
};

export const TaskListsWorkspace = () => {
  const [listsRefreshNonce, setListsRefreshNonce] = createSignal(0);
  const [tasksRefreshNonce, setTasksRefreshNonce] = createSignal(0);
  const [selectedListId, setSelectedListId] = createSignal<string | null>(null);
  const [optimisticListNames, setOptimisticListNames] = createSignal<Map<string, string>>(
    new Map()
  );
  const [listDialogOpen, setListDialogOpen] = createSignal(false);
  const [activeTaskId, setActiveTaskId] = createSignal<string | null>(null);
  const [focusTaskId, setFocusTaskId] = createSignal<string | null>(null);
  const [inlineEditTaskId, setInlineEditTaskId] = createSignal<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = createSignal("");
  const [inlineEditSaving, setInlineEditSaving] = createSignal(false);
  const [inlineEditError, setInlineEditError] = createSignal<string | null>(null);
  const [inlineCreate, setInlineCreate] = createSignal<InlineCreateState | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = createSignal(false);
  const [editingTask, setEditingTask] = createSignal<TaskItem | null>(null);
  const [expandedIds, setExpandedIds] = createSignal<Set<string>>(new Set());
  const [draggingTaskId, setDraggingTaskId] = createSignal<string | null>(null);
  const [activeDrop, setActiveDrop] = createSignal<
    { taskId: string; kind: DropKind } | null
  >(null);

  const runCreateList = useAction(createTaskList);
  const runUpdateList = useAction(updateTaskList);
  const runDeleteList = useAction(deleteTaskList);
  const runCreateTask = useAction(createTask);
  const runUpdateTask = useAction(updateTask);
  const runDeleteTask = useAction(deleteTask);
  const runMoveTask = useAction(moveTask);

  const refreshLists = () => setListsRefreshNonce((value) => value + 1);
  const refreshTasks = () => setTasksRefreshNonce((value) => value + 1);
  const openCreateListDialog = () => setListDialogOpen(true);

  const [lists] = createResource(
    () => listsRefreshNonce(),
    async (refresh) => fetchTaskLists({ refresh })
  );

  const [tasks, { mutate: mutateTasks, refetch: refetchTasks }] = createResource(
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
      batch(() => {
        setSelectedListId(null);
        setActiveTaskId(null);
      });
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
  const visibleTaskIds = createMemo(() => {
    const orderedIds: string[] = [];
    const expanded = expandedIds();

    const walk = (nodes: ReturnType<typeof tree>) => {
      for (const node of nodes) {
        orderedIds.push(node.task.id);
        if (expanded.has(node.task.id) && node.children.length > 0) {
          walk(node.children);
        }
      }
    };

    walk(tree());
    return orderedIds;
  });

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

  const tasksById = createMemo(() => {
    const map = new Map<string, TaskItem>();
    for (const task of taskItems()) {
      map.set(task.id, task);
    }
    return map;
  });

  createEffect(() => {
    const currentActiveTaskId = activeTaskId();
    if (!currentActiveTaskId) return;
    if (!taskItems().some((task) => task.id === currentActiveTaskId)) {
      batch(() => {
        setActiveTaskId(null);
        setFocusTaskId(null);
      });
    }
  });

  createEffect(() => {
    const currentEditingTaskId = inlineEditTaskId();
    if (!currentEditingTaskId) return;
    if (!taskItems().some((task) => task.id === currentEditingTaskId)) {
      batch(() => {
        setInlineEditTaskId(null);
        setInlineEditValue("");
        setInlineEditSaving(false);
        setInlineEditError(null);
      });
    }
  });

  const cancelInlineEdit = () => {
    batch(() => {
      setInlineEditTaskId(null);
      setInlineEditValue("");
      setInlineEditSaving(false);
      setInlineEditError(null);
    });
  };

  const cancelInlineCreate = () => {
    setInlineCreate(null);
  };

  const startInlineEdit = (task: TaskItem) => {
    batch(() => {
      setActiveTaskId(task.id);
      setFocusTaskId(task.id);
      setInlineCreate(null);
      setInlineEditTaskId(task.id);
      setInlineEditValue(formatTaskTitle(task.description, task.tags));
      setInlineEditSaving(false);
      setInlineEditError(null);
      setTaskDialogOpen(false);
    });
  };

  const startInlineCreate = () => {
    const currentActiveTaskId = activeTaskId();
    const task = currentActiveTaskId ? tasksById().get(currentActiveTaskId) ?? null : null;

    let parentTaskId: string | null = null;
    let targetIndex = (childrenByParent().get(null) ?? []).length;

    if (task) {
      const siblings = childrenByParent().get(task.parentTaskId) ?? [];
      const taskIndex = siblings.findIndex((item) => item.id === task.id);
      if (taskIndex >= 0) {
        parentTaskId = task.parentTaskId;
        targetIndex = taskIndex + 1;
      }
    }

    batch(() => {
      cancelInlineEdit();
      setInlineCreate({
        parentTaskId,
        targetIndex,
        value: "",
        saving: false,
        error: null,
      });
    });
  };

  const submitInlineEdit = async () => {
    const taskId = inlineEditTaskId();
    if (!taskId) return;
    const task = tasksById().get(taskId);
    if (!task) return;

    const parsed = parseTaskTitle(inlineEditValue());
    if (!parsed.description) {
      setInlineEditError("Task title needs text beyond tags.");
      return;
    }

    const titleUnchanged =
      parsed.description === task.description &&
      parsed.tags.length === task.tags.length &&
      parsed.tags.every((tag, index) => tag === task.tags[index]);

    if (titleUnchanged) {
      cancelInlineEdit();
      return;
    }

    setInlineEditSaving(true);
    setInlineEditError(null);

    try {
      await runUpdateTask({
        id: task.id,
        description: parsed.description,
        tags: parsed.tags,
      });
      cancelInlineEdit();
      refreshTasks();
      refreshLists();
    } catch (error) {
      setInlineEditError(error instanceof Error ? error.message : "Failed to save task");
      setInlineEditSaving(false);
    }
  };

  const submitInlineCreate = async () => {
    const draft = inlineCreate();
    const listId = selectedListId();
    if (!draft || !listId) return;

    const parsed = parseTaskTitle(draft.value);
    if (!parsed.description) {
      setInlineCreate((current) =>
        current
          ? {
              ...current,
              error: "Task title needs text beyond tags.",
            }
          : current
      );
      return;
    }

    setInlineCreate((current) =>
      current
        ? {
            ...current,
            saving: true,
            error: null,
          }
        : current
    );

    try {
      const created = await runCreateTask({
        listId,
        description: parsed.description,
        tags: parsed.tags,
        parentTaskId: draft.parentTaskId,
        targetIndex: draft.targetIndex,
      });

      if (draft.parentTaskId) {
        setExpandedIds((current) => new Set(current).add(draft.parentTaskId!));
      }

      batch(() => {
        setActiveTaskId(created.id);
        setFocusTaskId(created.id);
        setInlineCreate(null);
      });
      refreshTasks();
      refreshLists();
    } catch (error) {
      setInlineCreate((current) =>
        current
          ? {
              ...current,
              saving: false,
              error: error instanceof Error ? error.message : "Failed to create task",
            }
          : current
      );
    }
  };

  const openEditTaskDialog = (task: TaskItem) => {
    batch(() => {
      cancelInlineEdit();
      cancelInlineCreate();
      setActiveTaskId(task.id);
      setFocusTaskId(task.id);
      setEditingTask(task);
      setTaskDialogOpen(true);
    });
  };

  const toggleExpanded = (taskId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const onDrop = async (
    targetTaskId: string,
    kind: DropKind,
    draggedTaskId: string | null
  ) => {
    const movingId = draggedTaskId || draggingTaskId();
    if (!movingId || movingId === targetTaskId) return;

    const target = tasksById().get(targetTaskId);
    if (!target) return;

    let targetParentTaskId: string | null = null;
    let targetIndex = 0;

    if (kind === "inside") {
      targetParentTaskId = target.id;
      targetIndex = (childrenByParent().get(target.id) ?? []).length;
      setExpandedIds((current) => new Set(current).add(target.id));
    } else {
      targetParentTaskId = target.parentTaskId;
      const siblings = childrenByParent().get(target.parentTaskId) ?? [];
      const index = siblings.findIndex((item) => item.id === target.id);
      if (index < 0) return;
      targetIndex = kind === "before" ? index : index + 1;
    }

    await runMoveTask({
      taskId: movingId,
      targetParentTaskId,
      targetIndex,
    });

    batch(() => {
      setDraggingTaskId(null);
      setActiveDrop(null);
      setActiveTaskId(movingId);
      setFocusTaskId(movingId);
    });
    refreshTasks();
  };

  const onDropRoot = async (draggedTaskId: string | null) => {
    const movingId = draggedTaskId || draggingTaskId();
    if (!movingId) return;

    const roots = childrenByParent().get(null) ?? [];
    await runMoveTask({
      taskId: movingId,
      targetParentTaskId: null,
      targetIndex: roots.length,
    });

    batch(() => {
      setDraggingTaskId(null);
      setActiveDrop(null);
      setActiveTaskId(movingId);
      setFocusTaskId(movingId);
    });
    refreshTasks();
  };

  const selectAdjacentTask = (taskId: string, direction: "up" | "down") => {
    const ids = visibleTaskIds();
    const index = ids.findIndex((id) => id === taskId);
    if (index < 0) return;

    const nextIndex = direction === "up" ? index - 1 : index + 1;
    const nextTaskId = ids[nextIndex];
    if (!nextTaskId) return;

    batch(() => {
      setActiveTaskId(nextTaskId);
      setFocusTaskId(nextTaskId);
    });
  };

  const clearActiveSelection = () => {
    batch(() => {
      setActiveTaskId(null);
      setFocusTaskId(null);
    });

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  };

  const navigateTreeSelection = (taskId: string, direction: "left" | "right") => {
    const task = tasksById().get(taskId);
    if (!task) return;

    if (direction === "right") {
      const children = childrenByParent().get(task.id) ?? [];
      const firstChild = children[0];
      if (!firstChild) return;

      batch(() => {
        if (!expandedIds().has(task.id)) {
          setExpandedIds((current) => new Set(current).add(task.id));
        }
        setActiveTaskId(firstChild.id);
        setFocusTaskId(firstChild.id);
      });
      return;
    }

    if (expandedIds().has(task.id)) {
      setExpandedIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
      return;
    }

    if (!task.parentTaskId) return;

    batch(() => {
      setExpandedIds((current) => {
        const next = new Set(current);
        next.delete(task.parentTaskId!);
        return next;
      });
      setActiveTaskId(task.parentTaskId);
      setFocusTaskId(task.parentTaskId);
    });
  };

  const moveTaskByKeyboard = async (taskId: string, direction: MoveDirection) => {
    const task = tasksById().get(taskId);
    if (!task) return;

    const siblings = childrenByParent().get(task.parentTaskId) ?? [];
    const index = siblings.findIndex((item) => item.id === task.id);
    if (index < 0) return;

    if (direction === "up") {
      if (index === 0) return;
      batch(() => {
        setActiveTaskId(taskId);
        setFocusTaskId(taskId);
      });
      mutateTasks((current) =>
        current
          ? moveTaskLocally(current, taskId, task.parentTaskId, index - 1)
          : current
      );
      await runMoveTask({
        taskId,
        targetParentTaskId: task.parentTaskId,
        targetIndex: index - 1,
      });
      await refetchTasks();
      batch(() => {
        setActiveTaskId(taskId);
        setFocusTaskId(taskId);
      });
      return;
    }

    if (direction === "down") {
      if (index === siblings.length - 1) return;
      batch(() => {
        setActiveTaskId(taskId);
        setFocusTaskId(taskId);
      });
      mutateTasks((current) =>
        current
          ? moveTaskLocally(current, taskId, task.parentTaskId, index + 1)
          : current
      );
      await runMoveTask({
        taskId,
        targetParentTaskId: task.parentTaskId,
        targetIndex: index + 1,
      });
      await refetchTasks();
      batch(() => {
        setActiveTaskId(taskId);
        setFocusTaskId(taskId);
      });
      return;
    }

    if (direction === "right") {
      if (index === 0) return;
      const previousSibling = siblings[index - 1];
      const nextIndex = (childrenByParent().get(previousSibling.id) ?? []).length;
      batch(() => {
        setExpandedIds((current) => new Set(current).add(previousSibling.id));
        setActiveTaskId(taskId);
        setFocusTaskId(taskId);
      });
      mutateTasks((current) =>
        current ? moveTaskLocally(current, taskId, previousSibling.id, nextIndex) : current
      );
      await runMoveTask({
        taskId,
        targetParentTaskId: previousSibling.id,
        targetIndex: nextIndex,
      });
      await refetchTasks();
      batch(() => {
        setExpandedIds((current) => new Set(current).add(previousSibling.id));
        setActiveTaskId(taskId);
        setFocusTaskId(taskId);
      });
      return;
    }

    if (!task.parentTaskId) return;

    const parent = tasksById().get(task.parentTaskId);
    if (!parent) return;
    const grandparentId = parent.parentTaskId;
    const parentSiblings = childrenByParent().get(grandparentId) ?? [];
    const parentIndex = parentSiblings.findIndex((item) => item.id === parent.id);
    if (parentIndex < 0) return;

    batch(() => {
      setActiveTaskId(taskId);
      setFocusTaskId(taskId);
    });
    mutateTasks((current) =>
      current ? moveTaskLocally(current, taskId, grandparentId, parentIndex + 1) : current
    );
    await runMoveTask({
      taskId,
      targetParentTaskId: grandparentId,
      targetIndex: parentIndex + 1,
    });
    await refetchTasks();
    batch(() => {
      setActiveTaskId(taskId);
      setFocusTaskId(taskId);
    });
  };

  onMount(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isTextEntryTarget(event.target)) return;

      const selectedTaskId = activeTaskId();

      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.key === "ArrowUp" && selectedTaskId) {
          event.preventDefault();
          selectAdjacentTask(selectedTaskId, "up");
          return;
        }

        if (event.key === "ArrowDown" && selectedTaskId) {
          event.preventDefault();
          selectAdjacentTask(selectedTaskId, "down");
          return;
        }

        if (
          event.key === "Escape" &&
          selectedTaskId &&
          !inlineEditTaskId() &&
          !inlineCreate() &&
          !taskDialogOpen()
        ) {
          event.preventDefault();
          clearActiveSelection();
          return;
        }

        if (event.key.toLowerCase() === "n") {
          if (!selectedListId()) return;
          event.preventDefault();
          startInlineCreate();
        }
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  });

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
          onSelect={(id) => {
            batch(() => {
              setSelectedListId(id);
              setActiveTaskId(null);
              setFocusTaskId(null);
              cancelInlineEdit();
              cancelInlineCreate();
            });
          }}
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
        <HStack justifyContent="space-between" alignItems="center" mb="3" gap="3">
          <Stack gap="0">
            <Text fontSize="lg" fontWeight="semibold">
              {selectedList()?.name || "Task List"}
            </Text>
            <Text color="fg.muted" fontSize="sm">
              {taskItems().length} task{taskItems().length === 1 ? "" : "s"}
            </Text>
          </Stack>

          <HStack gap="2">
            <Text color="fg.muted" fontSize="xs">
              N new task • Alt + arrows move hierarchy
            </Text>
            <Button
              onClick={startInlineCreate}
              disabled={!selectedListId()}
              data-testid="task-create-button"
            >
              New Task
            </Button>
          </HStack>
        </HStack>

        <Show
          when={selectedListId()}
          fallback={<Box color="fg.muted">Create a list to start tracking tasks.</Box>}
        >
          <TaskTree
            nodes={tree()}
            expandedIds={expandedIds()}
            activeTaskId={activeTaskId()}
            focusTaskId={focusTaskId()}
            draggingTaskId={draggingTaskId()}
            activeDrop={activeDrop()}
            inlineEditTaskId={inlineEditTaskId()}
            inlineEditValue={inlineEditValue()}
            inlineEditSaving={inlineEditSaving()}
            inlineEditError={inlineEditError()}
            inlineCreate={inlineCreate()}
            onToggleExpanded={toggleExpanded}
            onDragStart={(taskId) => {
              batch(() => {
                setDraggingTaskId(taskId);
                setActiveDrop(null);
                setActiveTaskId(taskId);
                setFocusTaskId(taskId);
              });
            }}
            onDragEnd={() => {
              setDraggingTaskId(null);
              setActiveDrop(null);
            }}
            onDrop={(taskId, kind, draggedTaskId) =>
              void onDrop(taskId, kind, draggedTaskId)}
            onDragEnterTarget={(taskId, kind) => setActiveDrop({ taskId, kind })}
            onActivate={setActiveTaskId}
            onClearSelection={clearActiveSelection}
            onFocusSettled={(taskId) => {
              if (focusTaskId() === taskId) setFocusTaskId(null);
            }}
            onSelectAdjacent={selectAdjacentTask}
            onNavigateTree={navigateTreeSelection}
            onOpenInlineEdit={startInlineEdit}
            onOpenDetails={openEditTaskDialog}
            onInlineEditChange={(value) => {
              setInlineEditValue(value);
              if (inlineEditError()) setInlineEditError(null);
            }}
            onInlineEditSubmit={() => void submitInlineEdit()}
            onInlineEditCancel={cancelInlineEdit}
            onInlineCreateChange={(value) => {
              setInlineCreate((current) =>
                current
                  ? {
                      ...current,
                      value,
                      error: null,
                    }
                  : current
              );
            }}
            onInlineCreateSubmit={() => void submitInlineCreate()}
            onInlineCreateCancel={cancelInlineCreate}
            onMoveByKeyboard={(taskId, direction) =>
              void moveTaskByKeyboard(taskId, direction)}
            onDropRoot={(draggedTaskId) => void onDropRoot(draggedTaskId)}
            onDragEnterRoot={() => setActiveDrop(null)}
          />
        </Show>
      </Box>

      <TaskEditorDialog
        open={taskDialogOpen()}
        mode="edit"
        task={editingTask()}
        parentTaskId={editingTask()?.parentTaskId ?? null}
        parentOptions={taskItems()
          .filter((task) => task.id !== editingTask()?.id)
          .map((task) => ({ id: task.id, label: task.description.slice(0, 80) }))}
        onClose={() => setTaskDialogOpen(false)}
        onSubmit={async (value) => {
          const task = editingTask();
          if (!task) return;

          await runUpdateTask({
            id: task.id,
            description: value.description,
            status: value.status,
            dueDate: value.dueDate,
            durationMinutes: value.durationMinutes,
            tags: value.tags,
            meta: value.meta,
          });

          if (value.parentTaskId !== task.parentTaskId) {
            const siblings = childrenByParent().get(value.parentTaskId) ?? [];
            await runMoveTask({
              taskId: task.id,
              targetParentTaskId: value.parentTaskId,
              targetIndex: siblings.length,
            });
          }

          setActiveTaskId(task.id);
          refreshTasks();
          refreshLists();
        }}
        onDelete={
          editingTask()
            ? async () => {
                const task = editingTask();
                if (!task) return;
                await runDeleteTask({ id: task.id });
                if (activeTaskId() === task.id) setActiveTaskId(null);
                refreshTasks();
                refreshLists();
              }
            : undefined
        }
      />

      <TaskListEditorDialog
        open={listDialogOpen()}
        onClose={() => setListDialogOpen(false)}
        onSubmit={async (name) => {
          await runCreateList({ name });
          refreshLists();
        }}
      />
    </Box>
  );
};
