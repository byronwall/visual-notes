// Editable local-time form state for one show, and its conversion to the
// `occurrenceInputSchema` shape the actions accept.
import type { OccurrenceInput } from "~/lib/events/schemas";
import { instantToWallClock, isValidTimeZone } from "~/lib/events/time";
import {
  DEFAULT_TIME_ZONE,
  type EventDecision,
  type Occurrence,
  type OccurrenceStatus,
  type PlaceSummary,
} from "~/lib/events/types";

export type ShowDraft = {
  date: string;
  /** Empty means all day. */
  time: string;
  endDate: string;
  endTime: string;
  timeZone: string;
  timeConfirmed: boolean;
  label: string;
  /** Show-specific place; null uses the event's. */
  place: PlaceSummary | null;
  ticketStatus: string;
  status: OccurrenceStatus;
  decision: EventDecision;
  decisionNote: string;
};

export const emptyShowDraft = (date = ""): ShowDraft => ({
  date,
  time: "",
  endDate: "",
  endTime: "",
  timeZone: DEFAULT_TIME_ZONE,
  timeConfirmed: true,
  label: "",
  place: null,
  ticketStatus: "",
  status: "scheduled",
  decision: "unreviewed",
  decisionNote: "",
});

/** The stored show as local fields (client-safe mirror of `localFields`). */
export function draftFromShow(o: Occurrence): ShowDraft {
  const start = instantToWallClock(o.startsAt, o.timeZone);
  const end = o.endsAt ? instantToWallClock(o.endsAt, o.timeZone) : null;
  return {
    date: start.date,
    time: o.allDay ? "" : start.time,
    endDate: end && end.date !== start.date ? end.date : "",
    endTime: o.allDay || !end ? "" : end.time,
    timeZone: o.timeZone,
    timeConfirmed: o.timeConfirmed,
    label: o.label ?? "",
    place: o.place,
    ticketStatus: o.ticketStatus ?? "",
    status: o.status,
    decision: o.decision,
    decisionNote: o.decisionNote ?? "",
  };
}

const orNull = (value: string) => (value.trim() ? value.trim() : null);

export function draftToInput(d: ShowDraft): OccurrenceInput {
  return {
    date: d.date,
    time: orNull(d.time),
    endDate: orNull(d.endDate),
    endTime: d.time ? orNull(d.endTime) : null,
    timeZone: d.timeZone.trim() || DEFAULT_TIME_ZONE,
    timeConfirmed: d.timeConfirmed,
    label: orNull(d.label),
    placeId: d.place?.id ?? null,
    ticketStatus: orNull(d.ticketStatus),
    status: d.status,
    decision: d.decision,
    decisionNote: orNull(d.decisionNote),
  };
}

/** First problem with the draft, or null when it can be saved. */
export function draftError(d: ShowDraft): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return "Pick a date";
  const zone = d.timeZone.trim() || DEFAULT_TIME_ZONE;
  if (!isValidTimeZone(zone)) return `Unknown time zone "${zone}"`;
  if (d.endDate && d.endDate < d.date) return "End date is before the start";
  return null;
}
