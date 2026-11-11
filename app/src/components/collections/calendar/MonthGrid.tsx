import { PlusIcon } from "lucide-solid";
import { For, Index, createMemo, type JSX } from "solid-js";
import { css, cx } from "styled-system/css";
import { layoutWeek, type CalendarDay } from "~/lib/collections/group";
import type {
  CollectionProperty,
  CollectionRow,
} from "~/lib/collections/types";
import { draggable } from "../drag/startPointerDrag";

const LANE_HEIGHT = 24;
const DAY_HEADER = 26;
const MIN_LANES = 3;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const grid = css({
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  overflow: "hidden",
});
const weekdayRow = css({
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  bg: "bg.subtle",
  borderBottomWidth: "1px",
  borderColor: "border",
  "& > span": { px: "2", py: "1", fontSize: "xs", color: "fg.muted" },
});
const week = css({
  position: "relative",
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  "&:not(:last-child)": { borderBottomWidth: "1px", borderColor: "border" },
});
const day = css({
  position: "relative",
  borderRightWidth: "1px",
  borderColor: "border",
  "&:last-child": { borderRightWidth: "0" },
  "&[data-out]": { bg: "bg.subtle" },
  "&[data-over]": { bg: "blue.a3" },
  "& [data-add]": { opacity: "0" },
  "&:hover [data-add], & [data-add]:focus-visible": { opacity: "1" },
  // No hover on touch screens: keep Add visible.
  "@media (hover: none)": { "& [data-add]": { opacity: "1" } },
});
const dayNum = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  h: `${DAY_HEADER}px`,
  px: "1.5",
  fontSize: "xs",
  color: "fg.muted",
  "&[data-today] span:first-child": {
    bg: "red.9",
    color: "white",
    borderRadius: "full",
    minW: "5",
    h: "5",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "semibold",
  },
});
const addBtn = css({
  display: "inline-flex",
  p: "0.5",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  _hover: { bg: "bg.muted", color: "fg.default" },
});
const bar = css({
  position: "absolute",
  h: `${LANE_HEIGHT - 4}px`,
  display: "flex",
  alignItems: "center",
  gap: "1",
  px: "1.5",
  borderRadius: "l1",
  fontSize: "xs",
  fontWeight: "medium",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  cursor: "pointer",
  bg: "var(--chip-bg)",
  color: "var(--chip-fg)",
  _dark: { bg: "var(--chip-bg-dark)", color: "var(--chip-fg-dark)" },
  _hover: { filter: "brightness(0.96)" },
  "&[data-clip-start]": { borderLeftRadius: "0" },
  "&[data-clip-end]": { borderRightRadius: "0" },
});

/** Laptop month grid: bars span their days, lanes stack, every event shows. */
export const MonthGrid = (props: {
  viewId: string;
  weeks: CalendarDay[][];
  rows: CollectionRow[];
  property: CollectionProperty;
  overDay: string | null;
  colorFor: (row: CollectionRow) => JSX.CSSProperties;
  onEventPointerDown: (row: CollectionRow, e: PointerEvent) => void;
  onEventMenu: (row: CollectionRow, el: HTMLElement) => void;
  onOpen: (row: CollectionRow) => void;
  onCreate: (date: string) => void;
}) => (
  <div class={grid} data-calendar={props.viewId}>
    <div class={weekdayRow}>
      <For each={WEEKDAYS}>{(d) => <span>{d}</span>}</For>
    </div>
    <Index each={props.weeks}>
      {(w) => {
        const spans = createMemo(() =>
          layoutWeek(props.rows, props.property, w()[0]!.date),
        );
        const lanes = () =>
          Math.max(MIN_LANES, ...spans().map((s) => s.lane + 1));
        return (
          <div
            class={week}
            style={{ height: `${DAY_HEADER + lanes() * LANE_HEIGHT + 6}px` }}
          >
            <Index each={w()}>
              {(d) => (
                <div
                  class={day}
                  data-cal-day={d().date}
                  data-out={d().inMonth ? undefined : ""}
                  data-over={props.overDay === d().date ? "" : undefined}
                >
                  <div class={dayNum} data-today={d().isToday ? "" : undefined}>
                    <span>{Number(d().date.slice(8, 10))}</span>
                    <button
                      type="button"
                      class={addBtn}
                      data-add
                      aria-label={`New row on ${d().date}`}
                      onClick={() => props.onCreate(d().date)}
                    >
                      <PlusIcon size={12} />
                    </button>
                  </div>
                </div>
              )}
            </Index>
            <For each={spans()}>
              {(s) => (
                <div
                  class={cx(bar, draggable)}
                  role="button"
                  tabIndex={0}
                  title={s.row.title}
                  data-clip-start={s.clippedStart ? "" : undefined}
                  data-clip-end={s.clippedEnd ? "" : undefined}
                  style={{
                    ...props.colorFor(s.row),
                    left: `calc(${(s.startCol / 7) * 100}% + 3px)`,
                    width: `calc(${(s.span / 7) * 100}% - 6px)`,
                    top: `${DAY_HEADER + s.lane * LANE_HEIGHT}px`,
                  }}
                  onPointerDown={(e) => props.onEventPointerDown(s.row, e)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    // On touch the long-press release opens the menu instead.
                    if ((e as PointerEvent).pointerType === "touch") return;
                    props.onEventMenu(s.row, e.currentTarget);
                  }}
                  onClick={() => props.onOpen(s.row)}
                  onKeyDown={(e) => e.key === "Enter" && props.onOpen(s.row)}
                >
                  {s.row.title || "Untitled"}
                </div>
              )}
            </For>
          </div>
        );
      }}
    </Index>
  </div>
);
