import { Show } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { TaskDueFilters } from "./TaskDueFilters";
import { formatDuration, type DueFilter, type ListSummary } from "./taskFormat";
import { TaskShortcutsPopover } from "./TaskShortcutsPopover";

type Props = {
  title: string;
  summary: ListSummary;
  error: string | null;
  showDone: boolean;
  doneCount: number;
  onToggleDone: () => void;
  dueFilter: DueFilter | null;
  onToggleDue: (filter: DueFilter) => void;
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
      // Phones show the list name and filters in the list switcher row.
      display: { base: "none", lg: "flex" },
      alignItems: "flex-start",
      gap: "3",
      mb: "2",
    })}
  >
    <div class={css({ flex: "1", minW: "0" })}>
      <h1
        class={css({
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
            <TaskDueFilters
              overdue={props.summary.overdue}
              dueToday={props.summary.dueToday}
              active={props.dueFilter}
              onToggle={props.onToggleDue}
            />
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

    <div class={css({ display: "flex", alignItems: "center", gap: "1", flexShrink: 0, pt: "0.5" })}>
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
      <TaskShortcutsPopover />
    </div>
  </div>
);
