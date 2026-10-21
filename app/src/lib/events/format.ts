// Display strings for shows, computed in each show's own time zone so SSR
// and the browser agree.
import { instantToWallClock } from "./time";
import type { Occurrence } from "./types";

type Show = Pick<
  Occurrence,
  "startsAt" | "endsAt" | "allDay" | "timeConfirmed" | "timeZone"
>;

const MONTHS = [
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
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** `7:30 PM` from `19:30`. */
export function formatClock(time: string) {
  const [hh, mm] = time.split(":").map(Number);
  const suffix = hh! >= 12 ? "PM" : "AM";
  const hour = hh! % 12 === 0 ? 12 : hh! % 12;
  return `${hour}:${String(mm).padStart(2, "0")} ${suffix}`;
}

/** `Sat, Nov 7` (adds the year when it differs from `currentYear`). */
export function formatLocalDate(date: string, currentYear?: number) {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  const base = `${DAYS[dow]}, ${MONTHS[m! - 1]} ${d}`;
  return currentYear && currentYear !== y ? `${base}, ${y}` : base;
}

/** The show's local date `YYYY-MM-DD`, for grouping by day. */
export const showLocalDate = (show: Show) =>
  instantToWallClock(show.startsAt, show.timeZone).date;

/** `8:00 PM – 11:30 PM`, `All day`, or `Time TBD`. */
export function formatShowTime(show: Show) {
  if (!show.timeConfirmed) return "Time TBD";
  if (show.allDay) return "All day";
  const start = instantToWallClock(show.startsAt, show.timeZone);
  if (!show.endsAt) return formatClock(start.time);
  const end = instantToWallClock(show.endsAt, show.timeZone);
  const endText =
    end.date === start.date
      ? formatClock(end.time)
      : `${formatLocalDate(end.date)} ${formatClock(end.time)}`;
  return `${formatClock(start.time)} – ${endText}`;
}

/** `Sat, Nov 7 · 8:00 PM – 11:30 PM`. */
export function formatShowWhen(show: Show, currentYear?: number) {
  return `${formatLocalDate(showLocalDate(show), currentYear)} · ${formatShowTime(show)}`;
}
