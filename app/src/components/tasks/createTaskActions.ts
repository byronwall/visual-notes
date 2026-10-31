import { useAction } from "@solidjs/router";
import { batch, createEffect, createSignal, onCleanup } from "solid-js";
import {
  createTask,
  deleteTask,
  moveTask,
  moveTaskToList,
  updateTask,
  type TaskItem,
  type TaskStatus,
} from "~/services/tasks/tasks.service";
import type { TaskData } from "./createTaskData";
import { isDoneStatus, toDateKey } from "./taskFormat";
import {
  formatTaskTitle,
  parseTaskInput,
  type ParsedTaskInput,
} from "./taskTitle";
import {
  deleteTaskLocally,
  insertTaskLocally,
  isDescendantOf,
  moveTaskLocally,
  removeSubtreeLocally,
} from "./taskTreeOps";
import type {
  DropKind,
  InlineCreateState,
  InlineEditState,
  MoveDirection,
  TaskTreeContextValue,
} from "./TaskTreeContext";

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const createTaskActions = (
  data: TaskData,
  options: { focusQuickAdd: () => void; openDetails: (task: TaskItem) => void },
) => {
  // Marks each save so the live refresh skips this tab's own echo.
  const local =
    <A extends unknown[], R>(run: (...args: A) => Promise<R>) =>
    (...args: A) => {
      data.noteLocalWrite();
      return run(...args);
    };
  const runCreateTask = local(useAction(createTask));
  const runUpdateTask = local(useAction(updateTask));
  const runDeleteTask = local(useAction(deleteTask));
  const runMoveTask = local(useAction(moveTask));
  const runMoveToList = local(useAction(moveTaskToList));

  const [todayKey] = createSignal(toDateKey(new Date()));
  const [expandedIds, setExpandedIds] = createSignal<Set<string>>(new Set());
  const [activeTaskId, setActiveTaskId] = createSignal<string | null>(null);
  const [focusTaskId, setFocusTaskId] = createSignal<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = createSignal<string | null>(null);
  const [activeDrop, setActiveDrop] = createSignal<{
    taskId: string;
    kind: DropKind;
  } | null>(null);
  const [inlineEdit, setInlineEdit] = createSignal<InlineEditState | null>(
    null,
  );
  const [inlineCreate, setInlineCreate] =
    createSignal<InlineCreateState | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [revealTaskId, setRevealTaskId] = createSignal<string | null>(null);

  // Drop selection/edit state for tasks that disappeared (deleted, list switch).
  createEffect(() => {
    const byId = data.tasksById();
    if (activeTaskId() && !byId.has(activeTaskId()!)) setActiveTaskId(null);
    const edit = inlineEdit();
    if (edit && !byId.has(edit.taskId)) setInlineEdit(null);
  });

  // Optimistic writes reach the server one at a time, in order, and the tree
  // refetches only after they have been idle for a moment. Otherwise a
  // refetch for an earlier write can commit after a later optimistic edit and
  // revert it on screen, and the next keyboard move acts on the stale order.
  const RECONCILE_DELAY_MS = 400;
  let writeQueue: Promise<unknown> = Promise.resolve();
  let pendingWrites = 0;
  let reconcileTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(reconcileTimer));

  const scheduleReconcile = () => {
    clearTimeout(reconcileTimer);
    if (pendingWrites > 0) return;
    reconcileTimer = setTimeout(() => {
      if (pendingWrites === 0) data.refreshTasks();
    }, RECONCILE_DELAY_MS);
  };

  const queueWrite = (
    scope: string,
    fallback: string,
    write: () => Promise<unknown>,
  ) => {
    pendingWrites += 1;
    clearTimeout(reconcileTimer);
    writeQueue = writeQueue.then(() =>
      write()
        .catch((err) => {
          console.error(`[tasks] ${scope} failed`, err);
          setError(errorMessage(err, fallback));
        })
        .finally(() => {
          pendingWrites -= 1;
          scheduleReconcile();
        }),
    );
  };

  const select = (taskId: string | null, focus = true) =>
    batch(() => {
      setActiveTaskId(taskId);
      setFocusTaskId(focus ? taskId : null);
    });

  const expand = (taskId: string) =>
    setExpandedIds((current) =>
      current.has(taskId) ? current : new Set(current).add(taskId),
    );
  const collapse = (taskId: string) =>
    setExpandedIds((current) => {
      if (!current.has(taskId)) return current;
      const next = new Set(current);
      next.delete(taskId);
      return next;
    });

  const siblingsOf = (parentTaskId: string | null) =>
    data.children().get(parentTaskId) ?? [];
  const indexOf = (task: TaskItem) =>
    siblingsOf(task.parentTaskId).findIndex((t) => t.id === task.id);

  /** Ids in on-screen order, used for arrow-key selection. */
  const visibleIds = () => {
    const ordered: string[] = [];
    const walk = (ids: string[]) => {
      for (const id of ids) {
        ordered.push(id);
        if (expandedIds().has(id)) walk(data.visibleChildIds(id));
      }
    };
    walk(data.visibleChildIds(null));
    if (data.showDone()) walk(data.doneRootIds());
    return ordered;
  };

  const patchTask = (taskId: string, patch: Partial<TaskItem>) =>
    data.mutateTasks((current) =>
      current?.map((task) =>
        task.id === taskId ? { ...task, ...patch } : task,
      ),
    );

  // ---- status ----------------------------------------------------------
  const setStatus = (task: TaskItem, status: TaskStatus) => {
    if (task.status === status) return;
    setError(null);
    if (isDoneStatus(status) && !data.showDone())
      data.markRecentlyDone(task.id);
    patchTask(task.id, { status });
    queueWrite("status update", "Could not update status", () =>
      runUpdateTask({ id: task.id, status }),
    );
  };

  const toggleStatus = (task: TaskItem, status: TaskStatus) =>
    setStatus(task, task.status === status ? "waiting" : status);

  // ---- create ----------------------------------------------------------
  const insertCreated = async (
    parsed: ParsedTaskInput,
    parentTaskId: string | null,
    targetIndex: number,
  ) => {
    const listId = data.selectedListId();
    if (!listId) throw new Error("Pick a list first");
    const payload = {
      listId,
      description: parsed.description,
      tags: parsed.tags,
      dueDate: parsed.dueDate ?? null,
      durationMinutes: parsed.durationMinutes ?? null,
      parentTaskId,
      targetIndex,
    };
    const created = await runCreateTask(payload);
    const now = new Date().toISOString();
    data.mutateTasks((current) =>
      insertTaskLocally(
        current ?? [],
        {
          id: created.id,
          listId,
          description: payload.description,
          status: "waiting",
          dueDate: payload.dueDate,
          durationMinutes: payload.durationMinutes,
          tags: payload.tags,
          meta: null,
          parentTaskId,
          sortOrder: targetIndex,
          createdAt: now,
          updatedAt: now,
        },
        targetIndex,
      ),
    );
    scheduleReconcile();
    data.refreshLists();
    return created.id;
  };

  const quickAdd = async (parsed: ParsedTaskInput) => {
    setError(null);
    const id = await insertCreated(parsed, null, siblingsOf(null).length);
    batch(() => {
      setActiveTaskId(id);
      setRevealTaskId(id);
    });
  };

  const startInlineCreate = () => {
    const active = activeTaskId()
      ? data.tasksById().get(activeTaskId()!)
      : undefined;
    if (!active) {
      options.focusQuickAdd();
      return;
    }
    batch(() => {
      setInlineEdit(null);
      setInlineCreate({
        parentTaskId: active.parentTaskId,
        afterTaskId: active.id,
        targetIndex: indexOf(active) + 1,
        value: "",
        saving: false,
        error: null,
      });
    });
  };

  const addSubtask = (task: TaskItem) => {
    const visible = data.visibleChildIds(task.id);
    batch(() => {
      expand(task.id);
      setInlineEdit(null);
      setActiveTaskId(task.id);
      setInlineCreate({
        parentTaskId: task.id,
        afterTaskId: visible[visible.length - 1] ?? null,
        targetIndex: siblingsOf(task.id).length,
        value: "",
        saving: false,
        error: null,
      });
    });
  };

  const inlineCreateSubmit = async () => {
    const draft = inlineCreate();
    if (!draft || draft.saving) return;
    const parsed = parseTaskInput(draft.value, todayKey());
    if (!parsed.description) {
      if (!draft.value.trim()) setInlineCreate(null);
      else setInlineCreate({ ...draft, error: "Add a title" });
      return;
    }
    setInlineCreate({ ...draft, saving: true, error: null });
    try {
      const id = await insertCreated(
        parsed,
        draft.parentTaskId,
        draft.targetIndex,
      );
      // Stay in flow: the next draft opens right below the one just created.
      batch(() => {
        setActiveTaskId(id);
        setInlineCreate({
          ...draft,
          afterTaskId: id,
          targetIndex: draft.targetIndex + 1,
          value: "",
          saving: false,
          error: null,
        });
      });
    } catch (err) {
      setInlineCreate({
        ...draft,
        saving: false,
        error: errorMessage(err, "Could not add task"),
      });
    }
  };

  const inlineCreateCancel = () => {
    const draft = inlineCreate();
    setInlineCreate(null);
    const anchor = draft?.afterTaskId ?? draft?.parentTaskId ?? null;
    if (anchor) select(anchor);
  };

  // ---- inline edit -----------------------------------------------------
  const openInlineEdit = (task: TaskItem) => {
    // The inline field holds one line, so saving there would merge the lines.
    if (task.description.includes("\n")) {
      options.openDetails(task);
      return;
    }
    batch(() => {
      setActiveTaskId(task.id);
      setInlineCreate(null);
      setInlineEdit({
        taskId: task.id,
        value: formatTaskTitle(task.description, task.tags),
        saving: false,
        error: null,
      });
    });
  };

  const inlineEditCancel = () => {
    const edit = inlineEdit();
    setInlineEdit(null);
    if (edit) select(edit.taskId);
  };

  const inlineEditSubmit = () => {
    const edit = inlineEdit();
    if (!edit || edit.saving) return;
    const task = data.tasksById().get(edit.taskId);
    if (!task) return setInlineEdit(null);

    const parsed = parseTaskInput(edit.value, todayKey());
    if (!parsed.description) {
      setInlineEdit({ ...edit, error: "Add a title" });
      return;
    }

    const patch: Partial<TaskItem> = {
      description: parsed.description,
      tags: parsed.tags,
    };
    if (parsed.dueDate !== undefined) patch.dueDate = parsed.dueDate;
    if (parsed.durationMinutes !== undefined)
      patch.durationMinutes = parsed.durationMinutes;

    const unchanged =
      patch.description === task.description &&
      parsed.tags.join("\u0000") === task.tags.join("\u0000") &&
      parsed.dueDate === undefined &&
      parsed.durationMinutes === undefined;

    batch(() => {
      setInlineEdit(null);
      if (document.activeElement?.tagName === "INPUT") select(task.id);
    });
    if (unchanged) return;

    setError(null);
    patchTask(task.id, patch);
    queueWrite("title update", "Could not save task", () =>
      runUpdateTask({ id: task.id, ...patch }),
    );
  };

  // ---- delete ----------------------------------------------------------
  const removeTask = (task: TaskItem) => {
    setError(null);
    const ids = visibleIds();
    const nextId =
      ids[ids.indexOf(task.id) + 1] ?? ids[ids.indexOf(task.id) - 1] ?? null;
    data.mutateTasks((current) => deleteTaskLocally(current ?? [], task.id));
    select(nextId);
    queueWrite("delete", "Could not delete task", () =>
      runDeleteTask({ id: task.id }).then(() => data.refreshLists()),
    );
  };

  /** Sends a task, with its subtasks, to the end of another list. */
  const moveToList = (task: TaskItem, listId: string) => {
    setError(null);
    const ids = visibleIds();
    const nextId =
      ids[ids.indexOf(task.id) + 1] ?? ids[ids.indexOf(task.id) - 1] ?? null;
    data.mutateTasks((current) => removeSubtreeLocally(current ?? [], task.id));
    select(nextId);
    queueWrite("move to list", "Could not move task", () =>
      runMoveToList({ taskId: task.id, listId }).then(() => data.refreshLists()),
    );
  };

  // ---- moves -----------------------------------------------------------
  const applyMove = (
    taskId: string,
    parentTaskId: string | null,
    targetIndex: number,
  ) => {
    setError(null);
    if (parentTaskId) expand(parentTaskId);
    data.mutateTasks((current) =>
      current
        ? moveTaskLocally(current, taskId, parentTaskId, targetIndex)
        : current,
    );
    select(taskId);
    queueWrite("move", "Could not move task", () =>
      runMoveTask({ taskId, targetParentTaskId: parentTaskId, targetIndex }),
    );
  };

  const moveByKeyboard = (taskId: string, direction: MoveDirection) => {
    const task = data.tasksById().get(taskId);
    if (!task) return;
    const index = indexOf(task);
    if (index < 0) return;
    // Step over hidden (done) siblings so every press visibly moves the row.
    const visible = data.visibleChildIds(task.parentTaskId);
    const visibleIndex = visible.indexOf(taskId);
    const neighbor = (offset: number) => {
      const id = visible[visibleIndex + offset];
      return id ? data.tasksById().get(id) : undefined;
    };

    if (direction === "up") {
      const previous = neighbor(-1);
      if (previous) applyMove(taskId, task.parentTaskId, indexOf(previous));
      return;
    }
    if (direction === "down") {
      const next = neighbor(1);
      // moveTaskLocally/server both treat the index as pre-removal.
      if (next) applyMove(taskId, task.parentTaskId, indexOf(next) + 1);
      return;
    }
    if (direction === "right") {
      const previous = neighbor(-1);
      if (previous)
        applyMove(taskId, previous.id, siblingsOf(previous.id).length);
      return;
    }
    if (task.parentTaskId) {
      const parent = data.tasksById().get(task.parentTaskId);
      if (parent) applyMove(taskId, parent.parentTaskId, indexOf(parent) + 1);
    }
  };

  const drop = (
    targetTaskId: string,
    kind: DropKind,
    draggedTaskId: string | null,
  ) => {
    const movingId = draggedTaskId || draggingTaskId();
    batch(() => {
      setDraggingTaskId(null);
      setActiveDrop(null);
    });
    if (!movingId || movingId === targetTaskId) return;
    const target = data.tasksById().get(targetTaskId);
    if (!target || isDescendantOf(data.tasksById(), targetTaskId, movingId))
      return;

    if (kind === "inside") {
      return applyMove(movingId, target.id, siblingsOf(target.id).length);
    }
    const index = indexOf(target);
    if (index < 0) return;
    applyMove(
      movingId,
      target.parentTaskId,
      kind === "before" ? index : index + 1,
    );
  };

  const dropToRoot = (draggedTaskId: string | null) => {
    const movingId = draggedTaskId || draggingTaskId();
    batch(() => {
      setDraggingTaskId(null);
      setActiveDrop(null);
    });
    if (movingId) applyMove(movingId, null, siblingsOf(null).length);
  };

  // ---- selection -------------------------------------------------------
  const selectAdjacent = (taskId: string, direction: "up" | "down") => {
    const ids = visibleIds();
    const index = ids.indexOf(taskId);
    const next = ids[direction === "up" ? index - 1 : index + 1];
    if (next) select(next);
  };

  const selectFirst = () => {
    const first = visibleIds()[0];
    if (first) select(first);
  };

  const navigateTree = (taskId: string, direction: "left" | "right") => {
    const task = data.tasksById().get(taskId);
    if (!task) return;
    const childIds = data.visibleChildIds(task.id);
    if (direction === "right") {
      if (!childIds.length) return;
      if (!expandedIds().has(task.id)) return expand(task.id);
      return select(childIds[0]);
    }
    if (expandedIds().has(task.id) && childIds.length) return collapse(task.id);
    if (task.parentTaskId) select(task.parentTaskId);
  };

  const clearSelection = () => {
    select(null);
    const element = document.activeElement;
    if (element instanceof HTMLElement) element.blur();
  };

  const resetForListChange = () =>
    batch(() => {
      setActiveTaskId(null);
      setFocusTaskId(null);
      setInlineEdit(null);
      setInlineCreate(null);
      setError(null);
    });

  const context: TaskTreeContextValue = {
    todayKey,
    task: (taskId) => data.tasksById().get(taskId),
    childIds: data.visibleChildIds,
    progress: (taskId) => data.progress().get(taskId) ?? { done: 0, total: 0 },
    expandedIds,
    activeTaskId,
    tabStopId: () => {
      const active = activeTaskId();
      if (active && data.tasksById().has(active)) return active;
      return data.visibleChildIds(null)[0] ?? null;
    },
    revealTaskId,
    revealSettled: (taskId) => {
      if (revealTaskId() === taskId) setRevealTaskId(null);
    },
    focusTaskId,
    draggingTaskId,
    activeDrop,
    inlineEdit,
    inlineCreate,
    toggleExpanded: (taskId) =>
      expandedIds().has(taskId) ? collapse(taskId) : expand(taskId),
    dragStart: (taskId) =>
      batch(() => {
        setDraggingTaskId(taskId);
        setActiveDrop(null);
        setActiveTaskId(taskId);
      }),
    dragEnd: () =>
      batch(() => {
        setDraggingTaskId(null);
        setActiveDrop(null);
      }),
    dragOver: (taskId, kind) => {
      const current = activeDrop();
      if (current?.taskId !== taskId || current.kind !== kind)
        setActiveDrop({ taskId, kind });
    },
    drop,
    activate: (taskId) => setActiveTaskId(taskId),
    clearSelection,
    focusSettled: (taskId) => {
      if (focusTaskId() === taskId) setFocusTaskId(null);
    },
    selectAdjacent,
    navigateTree,
    moveByKeyboard,
    openInlineEdit,
    inlineEditChange: (value) =>
      setInlineEdit((current) =>
        current ? { ...current, value, error: null } : current,
      ),
    inlineEditSubmit,
    inlineEditCancel,
    inlineCreateChange: (value) =>
      setInlineCreate((current) =>
        current ? { ...current, value, error: null } : current,
      ),
    inlineCreateSubmit: () => void inlineCreateSubmit(),
    inlineCreateCancel,
    openDetails: (task) => {
      batch(() => {
        setInlineEdit(null);
        setInlineCreate(null);
        setActiveTaskId(task.id);
      });
      options.openDetails(task);
    },
    setStatus,
    toggleStatus,
    addSubtask,
    deleteTask: removeTask,
    otherLists: () =>
      data
        .mergedLists()
        .filter((list) => list.id !== data.selectedListId())
        .map((list) => ({ id: list.id, name: list.name })),
    moveToList,
  };

  return {
    context,
    error,
    setError,
    quickAdd,
    startInlineCreate,
    selectFirst,
    selectAdjacent,
    clearSelection,
    dropToRoot,
    resetForListChange,
    select,
    patchTask,
    runUpdateTask,
    runMoveTask,
    activeTaskId,
    draggingTaskId,
    inlineEdit,
    inlineCreate,
    setDropToRoot: () => setActiveDrop(null),
  };
};

export type TaskActions = ReturnType<typeof createTaskActions>;
