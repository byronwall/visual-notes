import {
  ArrowDownIcon,
  ArrowRightLeftIcon,
  ArrowUpIcon,
  IndentDecreaseIcon,
  IndentIncreaseIcon,
  ListPlusIcon,
  SquarePenIcon,
  Trash2Icon,
} from "lucide-solid";
import { createSignal, For } from "solid-js";
import { css } from "styled-system/css";
import type { TaskItem } from "~/services/tasks/tasks.service";
import { addDaysToKey, formatDue } from "./taskFormat";
import { TaskSheetAction, TaskSheetChoice } from "./TaskSheetButtons";
import {
  STATUS_META,
  STATUS_ORDER,
  TaskStatusIcon,
  statusColorClass,
} from "./TaskStatusIcon";
import { resolveDueToken } from "./taskTitle";
import { useTaskTree } from "./TaskTreeContext";

const gridClass = css({
  display: "grid",
  gap: "1",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
});
const sectionClass = css({ mt: "2.5" });
const labelClass = css({ mb: "1", fontSize: "xs", color: "fg.subtle" });
const DURATIONS = [
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
];

const dateInputClass = css({
  position: "absolute",
  inset: "0",
  w: "full",
  h: "full",
  opacity: 0,
  fontSize: "md",
});

type Props = {
  task: TaskItem;
  onShowSubtask: () => void;
  onShowLists: () => void;
};

/** Status, due date, time, order, and the other task actions. */
export const TaskSheetMain = (props: Props) => {
  const ctx = useTaskTree();
  const [confirmDelete, setConfirmDelete] = createSignal(false);

  const today = () => ctx.todayKey();
  const dues = () => [
    { label: "Today", key: today() },
    { label: "Tomorrow", key: addDaysToKey(today(), 1) },
    { label: "Next week", key: resolveDueToken("next-week", today())! },
  ];
  const customDue = () => {
    const due = props.task.dueDate;
    return due && !dues().some((item) => item.key === due) ? due : null;
  };
  const toggleDue = (key: string) =>
    ctx.updateFields(props.task, {
      dueDate: props.task.dueDate === key ? null : key,
    });

  return (
    <>
      <div class={sectionClass}>
        <div
          class={css({
            display: "grid",
            gap: "1",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          })}
          role="group"
          aria-label="Status"
        >
          <For each={STATUS_ORDER}>
            {(status) => (
              <TaskSheetAction
                label={STATUS_META[status].label}
                pressed={props.task.status === status}
                onClick={() => {
                  if (status === "complete") {
                    ctx.finishTask(props.task);
                    ctx.closeSheet();
                  } else ctx.setStatus(props.task, status);
                }}
              >
                <span class={statusColorClass} data-status={status}>
                  <TaskStatusIcon status={status} size={18} />
                </span>
              </TaskSheetAction>
            )}
          </For>
        </div>
      </div>

      <div class={sectionClass}>
        <div class={labelClass}>Due</div>
        <div class={gridClass}>
          <For each={dues()}>
            {(item) => (
              <TaskSheetChoice
                label={item.label}
                pressed={props.task.dueDate === item.key}
                onClick={() => toggleDue(item.key)}
              />
            )}
          </For>
          <div class={css({ position: "relative" })}>
            <TaskSheetChoice
              label={
                customDue()
                  ? formatDue(customDue()!, today()).absolute.split(", ")[1]
                  : "Date"
              }
              pressed={!!customDue()}
              onClick={() => undefined}
            />
            <input
              type="date"
              class={dateInputClass}
              aria-label="Pick a due date"
              data-testid="task-sheet-date"
              value={props.task.dueDate ?? ""}
              onChange={(event) =>
                ctx.updateFields(props.task, {
                  dueDate: event.currentTarget.value || null,
                })
              }
            />
          </div>
        </div>
      </div>

      <div class={sectionClass}>
        <div class={labelClass}>Time</div>
        <div class={gridClass}>
          <For each={DURATIONS}>
            {(item) => (
              <TaskSheetChoice
                label={item.label}
                pressed={props.task.durationMinutes === item.minutes}
                onClick={() =>
                  ctx.updateFields(props.task, {
                    durationMinutes:
                      props.task.durationMinutes === item.minutes
                        ? null
                        : item.minutes,
                  })
                }
              />
            )}
          </For>
        </div>
      </div>

      <div class={`${gridClass} ${css({ mt: "3" })}`}>
        <TaskSheetAction
          label="Up"
          disabled={!ctx.canMove(props.task.id, "up")}
          onClick={() => ctx.moveByKeyboard(props.task.id, "up")}
        >
          <ArrowUpIcon size={18} />
        </TaskSheetAction>
        <TaskSheetAction
          label="Down"
          disabled={!ctx.canMove(props.task.id, "down")}
          onClick={() => ctx.moveByKeyboard(props.task.id, "down")}
        >
          <ArrowDownIcon size={18} />
        </TaskSheetAction>
        <TaskSheetAction
          label="Nest"
          disabled={!ctx.canMove(props.task.id, "right")}
          onClick={() => ctx.moveByKeyboard(props.task.id, "right")}
        >
          <IndentIncreaseIcon size={18} />
        </TaskSheetAction>
        <TaskSheetAction
          label="Unnest"
          disabled={!ctx.canMove(props.task.id, "left")}
          onClick={() => ctx.moveByKeyboard(props.task.id, "left")}
        >
          <IndentDecreaseIcon size={18} />
        </TaskSheetAction>

        <TaskSheetAction label="Subtask" onClick={props.onShowSubtask}>
          <ListPlusIcon size={18} />
        </TaskSheetAction>
        <TaskSheetAction
          label="Move"
          disabled={ctx.otherLists().length === 0}
          onClick={props.onShowLists}
        >
          <ArrowRightLeftIcon size={18} />
        </TaskSheetAction>
        <TaskSheetAction
          label="Details"
          onClick={() => {
            ctx.closeSheet();
            ctx.openDetails(props.task);
          }}
        >
          <SquarePenIcon size={18} />
        </TaskSheetAction>
        <TaskSheetAction
          label={confirmDelete() ? "Sure?" : "Delete"}
          danger
          pressed={confirmDelete()}
          onClick={() => {
            if (!confirmDelete()) return setConfirmDelete(true);
            ctx.closeSheet();
            ctx.deleteTask(props.task);
          }}
        >
          <Trash2Icon size={18} />
        </TaskSheetAction>
      </div>
    </>
  );
};
