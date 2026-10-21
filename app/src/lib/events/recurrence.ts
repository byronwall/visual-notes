// Expands a repeat rule into explicit show dates. Shows are stored one row
// per date, so each can be moved, skipped, or decided on its own.
import { addDays, wallClockToInstant, weekday } from "./time";

export type RepeatRule =
  | { freq: "daily"; interval?: number }
  | {
      freq: "weekly";
      interval?: number;
      /** 0 = Sunday; defaults to the start's day */ weekdays?: number[];
    }
  /** `day`: same day of month; `nth-weekday`: e.g. 2nd Tuesday (5th = last). */
  | { freq: "monthly"; interval?: number; by?: "day" | "nth-weekday" };

export type RepeatInput = {
  /** First show's local date `YYYY-MM-DD`. */
  startDate: string;
  /** Local start `HH:mm`; omit for all-day shows. */
  startTime?: string | null;
  durationMinutes?: number | null;
  timeZone: string;
  rule: RepeatRule;
  /** Number of shows including the first (max 104). */
  count?: number;
  /** Last allowed local date, inclusive. */
  until?: string;
};

export type GeneratedShow = {
  date: string;
  startsAt: string;
  endsAt: string | null;
};

export const MAX_REPEAT_COUNT = 104;

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const pad = (n: number) => String(n).padStart(2, "0");

/** The `nth` (1-based, 5 = last) `dow` of a month, as `YYYY-MM-DD`. */
function nthWeekdayOfMonth(
  year: number,
  month: number,
  dow: number,
  nth: number,
) {
  const first = weekday(`${year}-${pad(month)}-01`);
  const firstMatch = 1 + ((dow - first + 7) % 7);
  let day = firstMatch + (nth - 1) * 7;
  const last = daysInMonth(year, month);
  if (nth >= 5 || day > last) {
    day = firstMatch;
    while (day + 7 <= last) day += 7;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function* candidateDates(
  startDate: string,
  rule: RepeatRule,
): Generator<string> {
  const interval = Math.max(1, Math.floor(rule.interval ?? 1));
  if (rule.freq === "daily") {
    for (let i = 0; ; i++) yield addDays(startDate, i * interval);
  }
  if (rule.freq === "weekly") {
    const days = [
      ...new Set(rule.weekdays?.length ? rule.weekdays : [weekday(startDate)]),
    ].sort();
    const weekStart = addDays(startDate, -weekday(startDate));
    for (let w = 0; ; w += interval) {
      for (const dow of days) {
        const date = addDays(weekStart, w * 7 + dow);
        if (date >= startDate) yield date;
      }
    }
  }
  if (rule.freq === "monthly") {
    const [y, m, d] = startDate.split("-").map(Number) as [
      number,
      number,
      number,
    ];
    const nth = Math.ceil(d / 7);
    const dow = weekday(startDate);
    for (let i = 0; ; i += interval) {
      const index = m - 1 + i;
      const year = y + Math.floor(index / 12);
      const month = (index % 12) + 1;
      if (rule.by === "nth-weekday") {
        yield nthWeekdayOfMonth(year, month, dow, nth);
      } else if (d <= daysInMonth(year, month)) {
        yield `${year}-${pad(month)}-${pad(d)}`;
      }
    }
  }
}

/** Show dates for a repeat rule, stopping at `count`, `until`, or the cap. */
export function expandRepeat(input: RepeatInput): GeneratedShow[] {
  const limit = Math.min(
    MAX_REPEAT_COUNT,
    Math.max(1, input.count ?? MAX_REPEAT_COUNT),
  );
  if (input.count === undefined && !input.until) {
    throw new Error("A repeat needs a count or an end date");
  }
  const shows: GeneratedShow[] = [];
  for (const date of candidateDates(input.startDate, input.rule)) {
    if (input.until && date > input.until) break;
    if (shows.length >= limit) break;
    const start = input.startTime
      ? wallClockToInstant(date, input.startTime, input.timeZone)
      : wallClockToInstant(date, "00:00", input.timeZone);
    const end =
      input.startTime && input.durationMinutes
        ? new Date(start.getTime() + input.durationMinutes * 60000)
        : null;
    shows.push({
      date,
      startsAt: start.toISOString(),
      endsAt: end ? end.toISOString() : null,
    });
  }
  return shows;
}

/** Human summary such as "Every 2 weeks on Tue" or "Monthly on the 2nd Tue". */
export function describeRepeat(rule: RepeatRule, startDate: string) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const interval = Math.max(1, rule.interval ?? 1);
  if (rule.freq === "daily")
    return interval === 1 ? "Daily" : `Every ${interval} days`;
  if (rule.freq === "weekly") {
    const days = (rule.weekdays?.length ? rule.weekdays : [weekday(startDate)])
      .map((d) => names[d])
      .join(", ");
    return `${interval === 1 ? "Weekly" : `Every ${interval} weeks`} on ${days}`;
  }
  const every = interval === 1 ? "Monthly" : `Every ${interval} months`;
  if (rule.by === "nth-weekday") {
    const nth = Math.ceil(Number(startDate.slice(8, 10)) / 7);
    const ord = nth >= 5 ? "last" : ["1st", "2nd", "3rd", "4th"][nth - 1];
    return `${every} on the ${ord} ${names[weekday(startDate)]}`;
  }
  return `${every} on day ${Number(startDate.slice(8, 10))}`;
}
