import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import type { TaskItem } from "~/services/tasks/tasks.service";
import { formatDue, formatDuration, isDoneStatus } from "./taskFormat";

type Props = {
  task: TaskItem;
  todayKey: string;
  childProgress: { done: number; total: number };
  error: string | null;
};

const metaClass = css({
  ml: "auto",
  display: "flex",
  alignItems: "baseline",
  justifyContent: "flex-end",
  flexWrap: "wrap",
  columnGap: "3",
  py: "0.5",
  fontSize: "xs",
  lineHeight: "1.25rem",
  color: "fg.muted",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
});

const dueClass = css({
  minW: "4.5rem",
  textAlign: "right",
  "&[data-tone=overdue]": { color: "red.11", fontWeight: "medium" },
  "&[data-tone=today]": { color: "amber.11", fontWeight: "medium" },
  "&[data-tone=done]": { color: "fg.subtle" },
});

const durationClass = css({ minW: "3.25rem", textAlign: "right" });

export const TaskRowMeta = (props: Props) => {
  const due = () =>
    props.task.dueDate
      ? formatDue(props.task.dueDate, props.todayKey, isDoneStatus(props.task.status))
      : null;

  return (
    <div class={metaClass}>
      <Show when={props.error}>
        {(error) => <span class={css({ color: "red.11", whiteSpace: "normal" })}>{error()}</span>}
      </Show>
      <Show when={props.childProgress.total > 0}>
        <span
          title={`${props.childProgress.done} of ${props.childProgress.total} subtasks done`}
          data-testid={`task-progress-${props.task.id}`}
        >
          {props.childProgress.done}/{props.childProgress.total}
        </span>
      </Show>
      <For each={props.task.tags}>
        {(tag) => <span class={css({ color: "fg.subtle" })}>#{tag}</span>}
      </For>
      <span
        class={dueClass}
        data-tone={due()?.tone}
        title={due()?.absolute}
        data-testid={`task-due-${props.task.id}`}
      >
        {due()?.label ?? ""}
      </span>
      <span class={durationClass}>
        {props.task.durationMinutes ? formatDuration(props.task.durationMinutes) : ""}
      </span>
    </div>
  );
};
