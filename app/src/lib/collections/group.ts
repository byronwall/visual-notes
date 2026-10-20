import { rankBetween } from "./rank";
import type {
  CollectionProperty,
  CollectionRow,
  DateValue,
  SelectOption,
} from "./types";
import { datePart, isDateValue, readValue } from "./values";
import { addDaysToDate, startOfWeek } from "./query";

export type BoardGroup = {
  /** Option id, or null for rows with no value. */
  key: string | null;
  option: SelectOption | null;
  rows: CollectionRow[];
};

/** Properties a board can group by. */
export const canGroupBy = (p: CollectionProperty) =>
  p.kind === "select" || p.kind === "status";

/**
 * Buckets already-sorted rows into one group per option (in option order) plus
 * a trailing "No value" group. Rows pointing at a deleted option land there too.
 */
export function groupRows(
  rows: CollectionRow[],
  property: CollectionProperty,
  hidden: string[] = [],
): BoardGroup[] {
  const options = property.config.options ?? [];
  const groups = new Map<string | null, BoardGroup>(
    options.map((o) => [o.id, { key: o.id, option: o, rows: [] }]),
  );
  const none: BoardGroup = { key: null, option: null, rows: [] };
  for (const row of rows) {
    const value = readValue(row, property);
    const group = typeof value === "string" ? groups.get(value) : undefined;
    (group ?? none).rows.push(row);
  }
  const hiddenSet = new Set(hidden);
  return [...groups.values(), none].filter(
    (g) => !hiddenSet.has(g.key ?? "__none__"),
  );
}

/**
 * Rank for dropping a row at `index` in a column (the dragged row already
 * removed). Returns null when neighbors can't bracket a new rank.
 */
export function rankForDrop(
  column: CollectionRow[],
  index: number,
): { after: string | null; before: string | null } {
  const after = index > 0 ? column[index - 1]?.rank ?? null : null;
  const before = index < column.length ? column[index]?.rank ?? null : null;
  if (after && before && after >= before) return { after, before: null };
  if (!after && before === null && index > 0)
    return { after: null, before: null };
  return { after, before };
}

export { rankBetween };

// ---------- Calendar ----------

export type CalendarDay = { date: string; inMonth: boolean; isToday: boolean };

/** Six Sunday-first weeks covering a month (`YYYY-MM`). */
export function monthGrid(month: string, today: string): CalendarDay[][] {
  const first = `${month}-01`;
  let day = startOfWeek(first);
  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      week.push({
        date: day,
        inMonth: day.startsWith(month),
        isToday: day === today,
      });
      day = addDaysToDate(day, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
};

export type WeekSpan = {
  row: CollectionRow;
  /** Column (0–6) where the bar starts in this week, and how many days it covers. */
  startCol: number;
  span: number;
  /** Whether the event continues before/after this week. */
  clippedStart: boolean;
  clippedEnd: boolean;
  lane: number;
};

/**
 * Lays out date ranges as bars within one week, packing them into lanes so
 * overlapping bars stack instead of colliding.
 */
export function layoutWeek(
  rows: CollectionRow[],
  property: CollectionProperty,
  weekStart: string,
): WeekSpan[] {
  const weekEnd = addDaysToDate(weekStart, 6);
  const items = rows
    .map((row) => {
      const v = readValue(row, property);
      if (!isDateValue(v)) return null;
      const start = datePart(v.start);
      const end = v.end ? datePart(v.end) : start;
      if (end < weekStart || start > weekEnd) return null;
      return { row, start, end };
    })
    .filter(
      (x): x is { row: CollectionRow; start: string; end: string } =>
        x !== null,
    )
    .sort(
      (a, b) =>
        a.start.localeCompare(b.start) ||
        b.end.localeCompare(a.end) ||
        a.row.title.localeCompare(b.row.title),
    );
  const lanes: string[] = []; // last occupied day per lane
  return items.map(({ row, start, end }) => {
    const s = start < weekStart ? weekStart : start;
    const e = end > weekEnd ? weekEnd : end;
    const startCol = daysBetween(weekStart, s);
    const span = daysBetween(s, e) + 1;
    let lane = lanes.findIndex((last) => last < s);
    if (lane < 0) {
      lane = lanes.length;
      lanes.push(e);
    } else lanes[lane] = e;
    return {
      row,
      startCol,
      span,
      clippedStart: start < weekStart,
      clippedEnd: end > weekEnd,
      lane,
    };
  });
}

export function daysBetween(a: string, b: string): number {
  const toUtc = (d: string) =>
    Date.UTC(
      Number(d.slice(0, 4)),
      Number(d.slice(5, 7)) - 1,
      Number(d.slice(8, 10)),
    );
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** Moves a date value so it starts on `day`, keeping its length and time of day. */
export function moveDate(value: DateValue, day: string): DateValue {
  const delta = daysBetween(datePart(value.start), day);
  const shift = (v: string) =>
    `${addDaysToDate(datePart(v), delta)}${v.slice(10)}`;
  return value.end
    ? { start: shift(value.start), end: shift(value.end) }
    : { start: shift(value.start) };
}
