import { A } from "@solidjs/router";
import { For, Index, Show } from "solid-js";
import { css } from "styled-system/css";
import type { CalendarDay } from "~/lib/collections/group";
import { optionColorVars } from "~/lib/collections/colors";
import { DECISION_COLORS } from "~/lib/events/filters";
import { formatShowWhen } from "~/lib/events/format";
import { shortStart } from "~/lib/events/grouping";
import { DECISION_LABELS, type OccurrenceListItem } from "~/lib/events/types";

const MAX_CHIPS = 3;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const grid = css({
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  overflow: "hidden",
});
const weekday = css({
  px: { base: "1", md: "2" },
  py: "1",
  fontSize: "xs",
  color: "fg.muted",
  bg: "bg.subtle",
  borderBottomWidth: "1px",
  borderColor: "border",
});
const cell = css({
  display: "flex",
  flexDirection: "column",
  gap: "0.5",
  minW: "0",
  h: { base: "3.5rem", md: "7.5rem" },
  p: { base: "0.5", md: "1" },
  borderColor: "border",
  "&:not(:nth-child(7n))": { borderRightWidth: "1px" },
  "&:nth-child(n+8)": { borderTopWidth: "1px" },
  "&[data-out]": {
    bg: "bg.subtle",
    "& [data-day-num]": { color: "fg.subtle" },
  },
  "&[data-selected]": { bg: "bg.selected" },
  cursor: "pointer",
});
const dayNum = css({
  alignSelf: "flex-start",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minW: "6",
  h: "6",
  px: "1",
  borderRadius: "full",
  fontSize: "xs",
  color: "fg.muted",
  cursor: "pointer",
  _hover: { bg: "bg.emphasized", color: "fg.default" },
  "&[data-today]": { bg: "red.9", color: "white", fontWeight: "semibold" },
});
const chips = css({
  display: "flex",
  flexDirection: { base: "row", md: "column" },
  flexWrap: { base: "wrap", md: "nowrap" },
  gap: { base: "1", md: "0.5" },
  minW: "0",
  px: { base: "0.5", md: "0" },
});
const chip = css({
  display: "flex",
  alignItems: "center",
  gap: "1",
  minW: "0",
  h: { base: "2", md: "5" },
  w: { base: "2", md: "auto" },
  px: { base: "0", md: "1.5" },
  borderRadius: { base: "full", md: "l1" },
  fontSize: "xs",
  textDecoration: "none",
  whiteSpace: "nowrap",
  overflow: "hidden",
  bg: { base: "var(--chip-ink)", md: "var(--chip-bg)" },
  color: "var(--chip-fg)",
  _dark: {
    bg: { base: "var(--chip-ink)", md: "var(--chip-bg-dark)" },
    color: "var(--chip-fg-dark)",
  },
  // Phone dots are too small to tap; the tap selects the day instead.
  pointerEvents: { base: "none", md: "auto" },
  _hover: { filter: "brightness(0.95)" },
  "&[data-cancelled] [data-chip-title]": { textDecoration: "line-through" },
  "& [data-chip-time]": { fontWeight: "semibold", flexShrink: "0" },
  "& [data-chip-title]": { overflow: "hidden", textOverflow: "ellipsis" },
  "& > span": { display: { base: "none", md: "inline" } },
});
const more = css({
  fontSize: "2xs",
  color: "fg.muted",
  textAlign: "left",
  px: "1.5",
  cursor: "pointer",
  display: { base: "none", md: "block" },
  _hover: { color: "fg.default" },
});

const chipTitle = (s: OccurrenceListItem) =>
  `${s.title} · ${formatShowWhen(s)}${s.effectivePlace ? ` · ${s.effectivePlace.name}` : ""} · ${DECISION_LABELS[s.effectiveDecision]}`;

/** Six-week grid; chips link to notes, day numbers pick the agenda day. */
export function CalendarMonthGrid(props: {
  weeks: CalendarDay[][];
  byDate: Map<string, OccurrenceListItem[]>;
  selected: string;
  onSelect: (date: string) => void;
}) {
  const days = () => props.weeks.flat();
  return (
    <div class={grid} aria-label="Month">
      <For each={WEEKDAYS}>{(d) => <span class={weekday}>{d}</span>}</For>
      <Index each={days()}>
        {(d) => {
          const shows = () => props.byDate.get(d().date) ?? [];
          const overflow = () => shows().length - MAX_CHIPS;
          return (
            <div
              class={cell}
              data-cal-day={d().date}
              data-out={d().inMonth ? undefined : ""}
              data-selected={props.selected === d().date ? "" : undefined}
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest("a"))
                  props.onSelect(d().date);
              }}
            >
              <button
                type="button"
                class={dayNum}
                data-day-num
                data-today={d().isToday ? "" : undefined}
                aria-label={`Show ${d().date}`}
                aria-pressed={props.selected === d().date}
                onClick={() => props.onSelect(d().date)}
              >
                {Number(d().date.slice(8, 10))}
              </button>
              <div class={chips}>
                <For each={shows().slice(0, MAX_CHIPS)}>
                  {(s) => (
                    <A
                      href={`/docs/${s.docId}`}
                      class={chip}
                      title={chipTitle(s)}
                      data-cancelled={s.status === "cancelled" ? "" : undefined}
                      style={optionColorVars(
                        DECISION_COLORS[s.effectiveDecision],
                      )}
                    >
                      <Show when={shortStart(s)}>
                        {(t) => <span data-chip-time>{t()}</span>}
                      </Show>
                      <span data-chip-title>{s.title || "Untitled"}</span>
                    </A>
                  )}
                </For>
                <Show when={overflow() > 0}>
                  <button
                    type="button"
                    class={more}
                    onClick={() => props.onSelect(d().date)}
                  >
                    +{overflow()} more
                  </button>
                </Show>
              </div>
            </div>
          );
        }}
      </Index>
    </div>
  );
}
