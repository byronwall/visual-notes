import { createContext, useContext } from "solid-js";
import type { TaskItem, TaskStatus } from "~/services/tasks/tasks.service";

export type DropKind = "before" | "inside" | "after";
export type MoveDirection = "up" | "down" | "left" | "right";

export type InlineCreateState = {
  parentTaskId: string | null;
  /** Render the draft after this sibling; null puts it first under the parent. */
  afterTaskId: string | null;
  targetIndex: number;
  value: string;
  saving: boolean;
  error: string | null;
};

export type InlineEditState = {
  taskId: string;
  value: string;
  saving: boolean;
  error: string | null;
};

export type TaskTreeContextValue = {
  todayKey: () => string;
  task: (taskId: string) => TaskItem | undefined;
  /** Visible child ids for a parent (null = roots), already filtered for done. */
  childIds: (parentTaskId: string | null) => string[];
  /** Count of all descendants and finished descendants, ignoring filters. */
  progress: (taskId: string) => { done: number; total: number };
  expandedIds: () => Set<string>;
  activeTaskId: () => string | null;
  /** The one row reachable with Tab: the active row, else the first visible row. */
  tabStopId: () => string | null;
  /** A row to scroll into view and flash once (e.g. just created from quick-add). */
  revealTaskId: () => string | null;
  revealSettled: (taskId: string) => void;
  focusTaskId: () => string | null;
  draggingTaskId: () => string | null;
  activeDrop: () => { taskId: string; kind: DropKind } | null;
  inlineEdit: () => InlineEditState | null;
  inlineCreate: () => InlineCreateState | null;

  toggleExpanded: (taskId: string) => void;
  dragStart: (taskId: string) => void;
  dragEnd: () => void;
  dragOver: (taskId: string, kind: DropKind) => void;
  drop: (
    targetTaskId: string,
    kind: DropKind,
    draggedTaskId: string | null,
  ) => void;
  activate: (taskId: string) => void;
  clearSelection: () => void;
  focusSettled: (taskId: string) => void;
  selectAdjacent: (taskId: string, direction: "up" | "down") => void;
  navigateTree: (taskId: string, direction: "left" | "right") => void;
  moveByKeyboard: (taskId: string, direction: MoveDirection) => void;

  openInlineEdit: (task: TaskItem) => void;
  inlineEditChange: (value: string) => void;
  inlineEditSubmit: () => void;
  inlineEditCancel: () => void;
  inlineCreateChange: (value: string) => void;
  inlineCreateSubmit: () => void;
  inlineCreateCancel: () => void;

  openDetails: (task: TaskItem) => void;
  setStatus: (task: TaskItem, status: TaskStatus) => void;
  /** Toggles between `status` and waiting (the "x"/"s" keys and the checkbox). */
  toggleStatus: (task: TaskItem, status: TaskStatus) => void;
  addSubtask: (task: TaskItem) => void;
  deleteTask: (task: TaskItem) => void;
  /** Lists other than the open one, for "Move to list". */
  otherLists: () => { id: string; name: string }[];
  moveToList: (task: TaskItem, listId: string) => void;
};

const TaskTreeContext = createContext<TaskTreeContextValue>();

export const TaskTreeProvider = TaskTreeContext.Provider;

export const useTaskTree = () => {
  const value = useContext(TaskTreeContext);
  if (!value)
    throw new Error("useTaskTree must be used inside TaskTreeProvider");
  return value;
};
