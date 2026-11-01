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
  // Below md, the children join the row's grid: due and time form a right rail.
  display: { base: "contents", md: "flex" },
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

const subLineClass = css({
  display: { base: "flex", md: "contents" },
  flexWrap: "wrap",
  columnGap: "2",
  gridColumn: "1",
  fontSize: "xs",
  lineHeight: { base: "1rem", md: "1.25rem" },
  color: "fg.muted",
});

const dueClass = css({
  gridColumn: "2",
  gridRow: "1",
  alignSelf: { base: "center", md: "auto" },
  minW: { md: "4.5rem" },
  fontSize: "xs",
  textAlign: "right",
  whiteSpace: "nowrap",
  color: "fg.muted",
  fontVariantNumeric: "tabular-nums",
  _empty: { display: { base: "none", md: "block" } },
  "&[data-tone=overdue]": { color: "red.11", fontWeight: "medium" },
  "&[data-tone=today]": { color: "amber.11", fontWeight: "medium" },
  "&[data-tone=done]": { color: "fg.subtle" },
});

const durationClass = css({
  gridColumn: "2",
  gridRow: "2",
  minW: { md: "3.25rem" },
  fontSize: "xs",
  lineHeight: { base: "1rem", md: "1.25rem" },
  textAlign: "right",
  whiteSpace: "nowrap",
  color: "fg.subtle",
  fontVariantNumeric: "tabular-nums",
  _empty: { display: { base: "none", md: "block" } },
});

export const TaskRowMeta = (props: Props) => {
  const due = () =>
    props.task.dueDate
      ? formatDue(
          props.task.dueDate,
          props.todayKey,
          isDoneStatus(props.task.status),
        )
      : null;

  return (
    <div class={metaClass}>
      <Show when={props.error}>
        {(error) => (
          <span class={css({ color: "red.11", whiteSpace: "normal" })}>
            {error()}
          </span>
        )}
      </Show>
      <Show when={props.childProgress.total > 0 || props.task.tags.length > 0}>
        <span class={subLineClass}>
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
        </span>
      </Show>
      <span
        class={dueClass}
        data-tone={due()?.tone}
        title={due()?.absolute}
        data-testid={`task-due-${props.task.id}`}
      >
        {due()?.label ?? ""}
      </span>
      <span class={durationClass}>
        {props.task.durationMinutes
          ? formatDuration(props.task.durationMinutes)
          : ""}
      </span>
    </div>
  );
};
