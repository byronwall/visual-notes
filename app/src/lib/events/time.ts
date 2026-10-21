// Wall-clock ↔ instant conversion in a named IANA zone, without a tz library.

const pad = (n: number) => String(n).padStart(2, "0");

type WallClock = { date: string; time: string };

const partsFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

/** Local `YYYY-MM-DD` and `HH:mm` of an instant in `timeZone`. */
export function instantToWallClock(
  instant: Date | string,
  timeZone: string,
): WallClock {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  const parts = Object.fromEntries(
    partsFormatter(timeZone)
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** Offset of `timeZone` from UTC at `instant`, in minutes. */
function offsetMinutes(instant: Date, timeZone: string) {
  const { date, time } = instantToWallClock(instant, timeZone);
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const asUtc = Date.UTC(y!, m! - 1, d!, hh!, mm!);
  const truncated = Math.floor(instant.getTime() / 60000) * 60000;
  return Math.round((asUtc - truncated) / 60000);
}

/**
 * The instant at which clocks in `timeZone` read `date` `time`. A time that
 * a DST jump skips resolves to the later offset, like most calendars.
 */
export function wallClockToInstant(
  date: string,
  time: string,
  timeZone: string,
): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, hh!, mm!);
  let result = guess - offsetMinutes(new Date(guess), timeZone) * 60000;
  // Second pass settles guesses that crossed a DST boundary.
  result = guess - offsetMinutes(new Date(result), timeZone) * 60000;
  return new Date(result);
}

/** Adds whole days to a `YYYY-MM-DD` date string. */
export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/** Day of week for a `YYYY-MM-DD` date, 0 = Sunday. */
export function weekday(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

/** True when `timeZone` is a zone this runtime understands. */
export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
