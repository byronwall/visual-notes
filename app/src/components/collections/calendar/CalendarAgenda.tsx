import { CalendarClockIcon, PlusIcon } from "lucide-solid";
import { For, Show, type JSX } from "solid-js";
import { css } from "styled-system/css";
import { noAutofill } from "~/components/ui/no-autofill";
import type {
  CollectionProperty,
  CollectionRow,
} from "~/lib/collections/types";
import { dayLabel, rangeLabel, type AgendaDay } from "./agenda";

const list = css({ display: "flex", flexDirection: "column", gap: "3" });
const dayHead = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  h: "8",
  fontSize: "sm",
  fontWeight: "semibold",
  borderBottomWidth: "1px",
  borderColor: "border",
});
const todayTag = css({
  px: "1.5",
  borderRadius: "full",
  bg: "red.9",
  color: "white",
  fontSize: "2xs",
  fontWeight: "semibold",
  lineHeight: "1.6",
});
const iconBtn = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: "0",
  boxSize: "8",
  borderRadius: "l2",
  color: "fg.subtle",
  cursor: "pointer",
  transitionProperty: "color, background-color",
  transitionDuration: "140ms",
  _hover: { color: "fg.default", bg: "bg.muted" },
});
const eventRow = css({
  display: "flex",
  alignItems: "center",
  gap: "2.5",
  minH: "11",
  pl: "1",
  borderRadius: "l2",
  cursor: "pointer",
  transitionProperty: "background-color",
  transitionDuration: "140ms",
  _hover: { bg: "bg.muted" },
  _focusVisible: {
    outline: "2px solid token(colors.border.accent)",
    outlineOffset: "-2px",
  },
});
const dot = css({
  flexShrink: "0",
  boxSize: "2.5",
  borderRadius: "full",
  bg: "var(--chip-fg)",
  _dark: { bg: "var(--chip-fg-dark)" },
});
const text = css({
  display: "flex",
  flexDirection: "column",
  flex: "1",
  minW: "0",
  py: "1.5",
});
const title = css({
  fontSize: "sm",
  lineHeight: "1.35",
  wordBreak: "break-word",
});
const time = css({ color: "fg.muted", mr: "1.5", fontSize: "xs" });
const meta = css({ fontSize: "xs", color: "fg.muted" });
const hint = css({ fontSize: "sm", color: "fg.subtle", py: "1.5" });
const addOnDate = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  fontSize: "sm",
  color: "fg.muted",
  "& input": {
    h: "8",
    px: "2",
    borderWidth: "1px",
    borderColor: "border",
    borderRadius: "l2",
    bg: "bg.default",
    color: "fg.default",
    fontSize: "sm",
  },
});

/**
 * Phone calendar: each day of the month that has events (and today), with
 * full-width rows that open the record. Ranges list once, on their first day.
 */
export const CalendarAgenda = (props: {
  days: AgendaDay[];
  property: CollectionProperty;
  monthName: string;
  today: string;
  editable: boolean;
  colorFor: (row: CollectionRow) => JSX.CSSProperties;
  onOpen: (row: CollectionRow) => void;
  onCreate: (date: string) => void;
  onDateMenu: (row: CollectionRow, el: HTMLElement) => void;
}) => (
  <div class={list}>
    <For
      each={props.days}
      fallback={
        <span class={hint}>
          No {props.property.name.toLowerCase()} dates in {props.monthName}.
        </span>
      }
    >
      {(day) => (
        <section>
          <div class={dayHead}>
            <span>{dayLabel(day.date)}</span>
            <Show when={day.date === props.today}>
              <span class={todayTag}>Today</span>
            </Show>
            <span style={{ flex: "1" }} />
            <button
              type="button"
              class={iconBtn}
              aria-label={`New row on ${dayLabel(day.date)}`}
              onClick={() => props.onCreate(day.date)}
            >
              <PlusIcon size={15} />
            </button>
          </div>
          <For
            each={day.events}
            fallback={<div class={hint}>Nothing scheduled</div>}
          >
            {(ev) => (
              <div
                class={eventRow}
                role="button"
                tabIndex={0}
                style={props.colorFor(ev.row)}
                onClick={() => props.onOpen(ev.row)}
                onKeyDown={(e) =>
                  (e.key === "Enter" || e.key === " ") &&
                  (e.preventDefault(), props.onOpen(ev.row))
                }
              >
                <span class={dot} />
                <span class={text}>
                  <span class={title}>
                    <Show when={ev.time}>
                      <span class={time}>{ev.time}</span>
                    </Show>
                    {ev.row.title || "Untitled"}
                  </span>
                  <Show when={ev.end !== ev.start}>
                    <span class={meta}>{rangeLabel(ev.start, ev.end)}</span>
                  </Show>
                </span>
                <Show when={props.editable}>
                  <button
                    type="button"
                    class={iconBtn}
                    aria-label={`Change date of ${ev.row.title || "Untitled"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onDateMenu(ev.row, e.currentTarget);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <CalendarClockIcon size={15} />
                  </button>
                </Show>
              </div>
            )}
          </For>
        </section>
      )}
    </For>
    <Show when={props.editable}>
      <label class={addOnDate}>
        <PlusIcon size={14} />
        New on a date
        <input
          {...noAutofill}
          type="date"
          onChange={(e) => {
            const date = e.currentTarget.value;
            e.currentTarget.value = "";
            if (date) props.onCreate(date);
          }}
        />
      </label>
    </Show>
  </div>
);
