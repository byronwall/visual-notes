// Pure RFC 5545 writer for calendar feeds. Takes resolved shows and returns
// the `.ics` body; no database access so it is easy to test.
import { addDays, instantToWallClock } from "./time";
import { STATUS_LABELS, type OccurrenceListItem } from "./types";

export type IcsFeed = { id: string; name: string; description: string | null };

export type IcsShow = Pick<
  OccurrenceListItem,
  | "id"
  | "title"
  | "label"
  | "startsAt"
  | "endsAt"
  | "allDay"
  | "timeConfirmed"
  | "timeZone"
  | "effectivePlace"
  | "effectiveDecision"
  | "eventUrl"
  | "eventSummary"
  | "ticketStatus"
  | "status"
  | "sequence"
  | "updatedAt"
>;

const CRLF = "\r\n";
const MAX_OCTETS = 75;
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;
const encoder = new TextEncoder();

/** Escapes a TEXT value: backslash, semicolon, comma, and newlines. */
export function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Folds one content line at 75 octets without splitting a UTF-8 character. */
export function foldLine(line: string) {
  if (encoder.encode(line).length <= MAX_OCTETS) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // Continuation lines start with a space, which counts toward the limit.
    const limit = parts.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1;
    if (size + bytes > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

/** `20261107T013000Z` */
export function formatUtc(instant: Date | string) {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

const compactDate = (date: string) => date.replace(/-/g, "");

/** Strips characters that would break a URI or content line. */
const cleanUri = (value: string) => value.replace(/[\r\n\s]+/g, "");

/** True when the show publishes as an all-day (date-only) entry. */
export const isDateOnly = (show: Pick<IcsShow, "allDay" | "timeConfirmed">) =>
  show.allDay || !show.timeConfirmed;

function dateLines(show: IcsShow): string[] {
  if (!isDateOnly(show)) {
    const end = show.endsAt
      ? new Date(show.endsAt)
      : new Date(new Date(show.startsAt).getTime() + DEFAULT_DURATION_MS);
    return [`DTSTART:${formatUtc(show.startsAt)}`, `DTEND:${formatUtc(end)}`];
  }
  const startDate = instantToWallClock(show.startsAt, show.timeZone).date;
  let endDate = addDays(startDate, 1);
  if (show.allDay && show.endsAt) {
    // Stored all-day ends sit at midnight of the last day, so add one for
    // iCal's exclusive DTEND.
    const last = instantToWallClock(show.endsAt, show.timeZone).date;
    if (last > startDate) endDate = addDays(last, 1);
  }
  return [
    `DTSTART;VALUE=DATE:${compactDate(startDate)}`,
    `DTEND;VALUE=DATE:${compactDate(endDate)}`,
  ];
}

export function showSummary(show: IcsShow) {
  let text = show.title.trim() || "Untitled event";
  if (show.label?.trim()) text += ` — ${show.label.trim()}`;
  if (!show.timeConfirmed) text += " (time TBD)";
  return text;
}

function showDescription(show: IcsShow) {
  const lines: string[] = [];
  if (show.eventSummary?.trim()) lines.push(show.eventSummary.trim());
  if (show.ticketStatus?.trim())
    lines.push(`Tickets: ${show.ticketStatus.trim()}`);
  if (show.status !== "scheduled")
    lines.push(`Status: ${STATUS_LABELS[show.status]}`);
  return lines.join("\n");
}

function showStatus(show: IcsShow) {
  if (show.status === "cancelled") return "CANCELLED";
  if (show.effectiveDecision === "tentative") return "TENTATIVE";
  return "CONFIRMED";
}

function eventLines(feed: IcsFeed, show: IcsShow): string[] {
  const place = show.effectivePlace;
  const location = place
    ? [place.name, place.address].filter((s) => s?.trim()).join(", ")
    : "";
  const description = showDescription(show);
  const stamp = formatUtc(show.updatedAt);
  return [
    "BEGIN:VEVENT",
    `UID:${show.id}-${feed.id}@visual-notes`,
    `DTSTAMP:${stamp}`,
    `LAST-MODIFIED:${stamp}`,
    `SEQUENCE:${show.sequence}`,
    ...dateLines(show),
    `SUMMARY:${escapeText(showSummary(show))}`,
    ...(location ? [`LOCATION:${escapeText(location)}`] : []),
    ...(place?.latitude != null && place.longitude != null
      ? [`GEO:${place.latitude};${place.longitude}`]
      : []),
    ...(show.eventUrl?.trim() ? [`URL:${cleanUri(show.eventUrl)}`] : []),
    ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
    `STATUS:${showStatus(show)}`,
    ...(isDateOnly(show) ? ["TRANSP:TRANSPARENT"] : []),
    "END:VEVENT",
  ];
}

/** The full VCALENDAR body for one feed, with CRLF endings and folding. */
export function buildIcs(feed: IcsFeed, shows: IcsShow[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Visual Notes//Events//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(feed.name)}`,
    ...(feed.description?.trim()
      ? [`X-WR-CALDESC:${escapeText(feed.description.trim())}`]
      : []),
    "REFRESH-INTERVAL;VALUE=DURATION:PT4H",
    "X-PUBLISHED-TTL:PT4H",
    ...shows.flatMap((show) => eventLines(feed, show)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** File-name-safe slug for `Content-Disposition`. */
export function feedFileSlug(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "calendar";
}
