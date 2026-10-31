import { Show } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { formatDuration, type ListSummary } from "./taskFormat";
import { TaskShortcutsPopover } from "./TaskShortcutsPopover";

type Props = {
  title: string;
  summary: ListSummary;
  error: string | null;
  showDone: boolean;
  doneCount: number;
  onToggleDone: () => void;
};

const summaryClass = css({
  display: "flex",
  flexWrap: "wrap",
  columnGap: "2",
  fontSize: "sm",
  color: "fg.muted",
  fontVariantNumeric: "tabular-nums",
  minH: "5",
  "& [data-sep]": { color: "fg.subtle" },
});

export const TaskListHeader = (props: Props) => (
  <div
    class={css({
      display: "flex",
      alignItems: { base: "center", lg: "flex-start" },
      gap: "3",
      mb: { base: "1", lg: "2" },
    })}
  >
    <div class={css({ flex: "1", minW: "0" })}>
      <h1
        class={css({
          // The list switcher above already shows this name on phones.
          srOnly: { base: true, lg: false },
          fontSize: "xl",
          fontWeight: "semibold",
          lineHeight: "1.75rem",
          color: "fg.default",
          overflowWrap: "anywhere",
        })}
        data-testid="task-list-title"
      >
        {props.title}
      </h1>
      <Show
        when={props.error}
        fallback={
          <p class={summaryClass} data-testid="task-list-summary">
            <span>{props.summary.open} open</span>
            <Show when={props.summary.overdue > 0}>
              <span data-sep>·</span>
              <span class={css({ color: "red.11" })}>{props.summary.overdue} overdue</span>
            </Show>
            <Show when={props.summary.dueToday > 0}>
              <span data-sep>·</span>
              <span class={css({ color: "amber.11" })}>{props.summary.dueToday} due today</span>
            </Show>
            <Show when={props.summary.plannedMinutes > 0}>
              <span data-sep>·</span>
              <span>{formatDuration(props.summary.plannedMinutes)} planned</span>
            </Show>
          </p>
        }
      >
        {(message) => (
          <p class={summaryClass} role="alert">
            <span class={css({ color: "red.11" })}>{message()}</span>
          </p>
        )}
      </Show>
    </div>

    <div class={css({ display: "flex", alignItems: "center", gap: "1", flexShrink: 0, pt: { lg: "0.5" } })}>
      <Show when={props.doneCount > 0 || props.showDone}>
        <Button
          size="xs"
          variant="plain"
          color="fg.muted"
          aria-pressed={props.showDone}
          data-testid="task-toggle-done"
          onClick={props.onToggleDone}
        >
          {props.showDone ? "Hide done" : `Show done (${props.doneCount})`}
        </Button>
      </Show>
      <span class={css({ display: { base: "none", md: "inline-flex" } })}>
        <TaskShortcutsPopover />
      </span>
    </div>
  </div>
);
