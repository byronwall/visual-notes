import { addDaysToDate } from "~/lib/collections/query";
import type {
  CollectionProperty,
  CollectionRow,
} from "~/lib/collections/types";
import { datePart, isDateValue, readValue } from "~/lib/collections/values";
import { daysBetween, shiftMonth } from "~/lib/collections/group";

export type AgendaEvent = {
  row: CollectionRow;
  start: string;
  end: string;
  /** Time of day ("09:30") when the value has one. */
  time: string | null;
};
export type AgendaDay = { date: string; events: AgendaEvent[] };

/**
 * Days of `month` (`YYYY-MM`) that have events, plus today when it falls in
 * the month. A range is listed once, on its first day inside the month.
 */
export function agendaDays(
  rows: CollectionRow[],
  property: CollectionProperty,
  month: string,
  today: string,
): AgendaDay[] {
  const first = `${month}-01`;
  const last = addDaysToDate(`${shiftMonth(month, 1)}-01`, -1);
  const byDay = new Map<string, AgendaEvent[]>();
  for (const row of rows) {
    const v = readValue(row, property);
    if (!isDateValue(v)) continue;
    const start = datePart(v.start);
    const end = v.end ? datePart(v.end) : start;
    if (end < first || start > last) continue;
    const day = start < first ? first : start;
    const time = v.start.length > 10 ? v.start.slice(11, 16) : null;
    const list = byDay.get(day) ?? [];
    list.push({ row, start, end, time });
    byDay.set(day, list);
  }
  if (today.startsWith(month) && !byDay.has(today)) byDay.set(today, []);
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, events]) => ({
      date,
      events: events.sort(
        (a, b) =>
          (a.time ?? "").localeCompare(b.time ?? "") ||
          a.row.title.localeCompare(b.row.title),
      ),
    }));
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "Wed, Nov 11" for a `YYYY-MM-DD` day, without time-zone shifts. */
export function dayLabel(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return `${WEEKDAY[weekday]}, ${MONTH[m! - 1]} ${d}`;
}

/** "Nov 3 – Nov 12 · 10 days" for a multi-day range. */
export function rangeLabel(start: string, end: string) {
  const short = (day: string) =>
    `${MONTH[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;
  return `${short(start)} – ${short(end)} · ${daysBetween(start, end) + 1} days`;
}
