import { Show } from "solid-js";
import { css } from "styled-system/css";
import type { DueFilter } from "./taskFormat";

type Props = {
  overdue: number;
  dueToday: number;
  active: DueFilter | null;
  onToggle: (filter: DueFilter) => void;
};

const filterClass = css({
  flexShrink: 0,
  minH: { base: "11", lg: "5" },
  px: { base: "1.5", lg: "1" },
  borderRadius: "l2",
  fontSize: "sm",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
  cursor: "pointer",
  transitionProperty: "background-color",
  transitionDuration: "fast",
  _hover: { bg: "bg.hover" },
  "&[aria-pressed=true]": { bg: "gray.a4", fontWeight: "medium" },
  _focusVisible: {
    outline: "2px solid token(colors.border.focus)",
    outlineOffset: "-2px",
  },
});

const sepClass = css({
  display: { base: "none", lg: "inline" },
  color: "fg.subtle",
});

/** The overdue and due-today counts, each a toggle that filters the list. */
export const TaskDueFilters = (props: Props) => (
  <>
    <Show when={props.overdue > 0}>
      <span class={sepClass}>·</span>
      <button
        type="button"
        class={`${filterClass} ${css({ color: "red.11" })}`}
        aria-pressed={props.active === "overdue"}
        data-testid="task-filter-overdue"
        onClick={() => props.onToggle("overdue")}
      >
        {props.overdue} overdue
      </button>
    </Show>
    <Show when={props.dueToday > 0}>
      <span class={sepClass}>·</span>
      <button
        type="button"
        class={`${filterClass} ${css({ color: "amber.11" })}`}
        aria-pressed={props.active === "today"}
        data-testid="task-filter-today"
        onClick={() => props.onToggle("today")}
      >
        {props.dueToday} today
      </button>
    </Show>
  </>
);
