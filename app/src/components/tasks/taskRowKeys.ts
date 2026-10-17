import type { TaskItem } from "~/services/tasks/tasks.service";
import type { MoveDirection, TaskTreeContextValue } from "./TaskTreeContext";

const ARROW_DIRECTIONS: Record<string, MoveDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/** Alt+arrow reorders/indents; shared by the row and its inline title input. */
export const handleMoveKey = (
  event: KeyboardEvent,
  task: TaskItem,
  ctx: TaskTreeContextValue
) => {
  if (!event.altKey) return false;
  const direction = ARROW_DIRECTIONS[event.key];
  if (!direction) return false;
  event.preventDefault();
  ctx.moveByKeyboard(task.id, direction);
  return true;
};

export const handleRowKeyDown = (
  event: KeyboardEvent,
  task: TaskItem,
  ctx: TaskTreeContextValue
) => {
  if (handleMoveKey(event, task, ctx)) return;
  if (event.altKey) return;

  const modified = event.metaKey || event.ctrlKey;
  const key = event.key;

  const run = (fn: () => void) => {
    event.preventDefault();
    fn();
  };

  if (key === "Enter" && modified) return run(() => ctx.openDetails(task));
  if (modified) return;

  switch (key) {
    case "Escape":
      return run(ctx.clearSelection);
    case "ArrowUp":
      return run(() => ctx.selectAdjacent(task.id, "up"));
    case "ArrowDown":
      return run(() => ctx.selectAdjacent(task.id, "down"));
    case "ArrowLeft":
      return run(() => ctx.navigateTree(task.id, "left"));
    case "ArrowRight":
      return run(() => ctx.navigateTree(task.id, "right"));
    case "Enter":
    case "F2":
      return run(() => ctx.openInlineEdit(task));
    case " ":
    case "x":
    case "X":
      return run(() => ctx.toggleStatus(task, "complete"));
    case "s":
    case "S":
      return run(() => ctx.toggleStatus(task, "started"));
  }
};
