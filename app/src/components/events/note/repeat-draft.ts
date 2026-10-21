// Form state for the "Repeat…" dialog and its conversion to a repeat rule.
import type { RepeatOccurrencesInput } from "~/lib/events/schemas";
import {
  MAX_REPEAT_COUNT,
  describeRepeat,
  expandRepeat,
  type GeneratedShow,
  type RepeatRule,
} from "~/lib/events/recurrence";
import { isValidTimeZone, weekday } from "~/lib/events/time";
import { DEFAULT_TIME_ZONE } from "~/lib/events/types";

export type RepeatMode = "weekly" | "monthly-day" | "monthly-nth";

export type RepeatDraft = {
  date: string;
  time: string;
  endTime: string;
  timeZone: string;
  mode: RepeatMode;
  interval: number;
  weekdays: number[];
  endBy: "count" | "until";
  count: number;
  until: string;
};

export const repeatDraftFrom = (seed: {
  date: string;
  time: string;
  endTime: string;
  timeZone: string;
}): RepeatDraft => ({
  ...seed,
  mode: "weekly",
  interval: 1,
  weekdays: seed.date ? [weekday(seed.date)] : [],
  endBy: "count",
  count: 4,
  until: "",
});

const minutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h! * 60 + m!;
};

export function draftRule(d: RepeatDraft): RepeatRule {
  const interval = Math.max(1, Math.floor(d.interval || 1));
  if (d.mode === "weekly") {
    return { freq: "weekly", interval, weekdays: [...d.weekdays].sort() };
  }
  return {
    freq: "monthly",
    interval,
    by: d.mode === "monthly-nth" ? "nth-weekday" : "day",
  };
}

export function repeatError(d: RepeatDraft): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return "Pick a first date";
  if (!isValidTimeZone(d.timeZone.trim() || DEFAULT_TIME_ZONE)) {
    return "Unknown time zone";
  }
  if (d.mode === "weekly" && d.weekdays.length === 0) return "Pick a weekday";
  if (d.endBy === "count" && !(d.count >= 1 && d.count <= MAX_REPEAT_COUNT)) {
    return `Repeat 1–${MAX_REPEAT_COUNT} times`;
  }
  if (d.endBy === "until" && !(d.until && d.until >= d.date)) {
    return "Pick an end date on or after the first date";
  }
  return null;
}

/** Summary text and generated dates, or null while the draft is invalid. */
export function repeatPreview(
  d: RepeatDraft,
): { summary: string; shows: GeneratedShow[] } | null {
  if (repeatError(d)) return null;
  const rule = draftRule(d);
  const duration =
    d.time && d.endTime
      ? (minutes(d.endTime) - minutes(d.time) + 1440) % 1440 || null
      : null;
  const shows = expandRepeat({
    startDate: d.date,
    startTime: d.time || null,
    durationMinutes: duration,
    timeZone: d.timeZone.trim() || DEFAULT_TIME_ZONE,
    rule,
    count: d.endBy === "count" ? d.count : undefined,
    until: d.endBy === "until" ? d.until : undefined,
  });
  return { summary: describeRepeat(rule, d.date), shows };
}

export function repeatInput(d: RepeatDraft): RepeatOccurrencesInput {
  return {
    show: {
      date: d.date,
      time: d.time || null,
      endTime: d.time && d.endTime ? d.endTime : null,
      timeZone: d.timeZone.trim() || DEFAULT_TIME_ZONE,
    },
    rule: draftRule(d),
    ...(d.endBy === "count" ? { count: d.count } : { until: d.until }),
  };
}
