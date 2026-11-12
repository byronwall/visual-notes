// Calendar days for People: encounters and learned dates are local days in
// Byron's time zone, kept as YYYY-MM-DD strings end to end. The database
// column is `date`; Prisma hands it back as UTC midnight.

export const PEOPLE_TIME_ZONE = "America/Indiana/Indianapolis";

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today in the People time zone, e.g. 2026-11-11. */
export function todayLocal(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PEOPLE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** True for a real calendar day in YYYY-MM-DD form (no Feb 30). */
export function isRealDay(value: string): boolean {
  const m = DAY.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
  );
}

/** The `date` column value for a day string. */
export const dayToDb = (day: string) => new Date(`${day}T00:00:00.000Z`);

/** A `date` column value back to its day string. */
export const dbToDay = (date: Date) => date.toISOString().slice(0, 10);

export const dbToDayOrNull = (date: Date | null) =>
  date ? dbToDay(date) : null;

/** Shifts a day string by whole days. */
export function addDays(day: string, days: number): string {
  const date = dayToDb(day);
  date.setUTCDate(date.getUTCDate() + days);
  return dbToDay(date);
}

/** "Mar 4, 2026" for display; the day never shifts with the browser zone. */
export function formatDay(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dayToDb(day));
}

/** "today", "3 days ago", "5 months ago" relative to `today`. */
export function daysAgoLabel(day: string, today: string): string {
  const diff = Math.round(
    (dayToDb(today).getTime() - dayToDb(day).getTime()) / 86_400_000,
  );
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 45) return `${diff} days ago`;
  const months = Math.round(diff / 30.4);
  if (months < 18) return `${months} months ago`;
  return `${Math.round(diff / 365.25)} years ago`;
}
