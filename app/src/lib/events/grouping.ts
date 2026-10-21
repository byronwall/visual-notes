// Pure grouping helpers for the /events list, calendar, and map.
import { formatClock, showLocalDate } from "./format";
import { instantToWallClock } from "./time";
import type { OccurrenceListItem, PlaceSummary } from "./types";

export type DayGroup = { date: string; shows: OccurrenceListItem[] };

/** Consecutive runs of shows on the same local day (input is date-sorted). */
export function groupByDay(items: OccurrenceListItem[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const show of items) {
    const date = showLocalDate(show);
    const last = groups[groups.length - 1];
    if (last?.date === date) last.shows.push(show);
    else groups.push({ date, shows: [show] });
  }
  return groups;
}

/** Shows keyed by local date, for calendar cells. */
export function showsByDate(items: OccurrenceListItem[]) {
  const map = new Map<string, OccurrenceListItem[]>();
  for (const g of groupByDay(items)) {
    map.set(g.date, [...(map.get(g.date) ?? []), ...g.shows]);
  }
  return map;
}

/** `8pm`, `7:30pm`, `TBD`, or empty for an all-day show. */
export function shortStart(
  show: Pick<
    OccurrenceListItem,
    "startsAt" | "allDay" | "timeConfirmed" | "timeZone"
  >,
) {
  if (!show.timeConfirmed) return "TBD";
  if (show.allDay) return "";
  const clock = formatClock(
    instantToWallClock(show.startsAt, show.timeZone).time,
  );
  return clock.replace(":00", "").replace(" ", "").toLowerCase();
}

export type PlacePoint = {
  place: PlaceSummary & { latitude: number; longitude: number };
  shows: OccurrenceListItem[];
};

export const hasCoords = <
  T extends { latitude: number | null; longitude: number | null },
>(
  p: T,
): p is T & { latitude: number; longitude: number } =>
  p.latitude != null && p.longitude != null;

/**
 * Shows grouped by their effective place, in first-show order. Shows without
 * a mapped place are counted in `unmapped`.
 */
export function groupShowsByPlace(items: OccurrenceListItem[]) {
  const points = new Map<string, PlacePoint>();
  let unmapped = 0;
  for (const show of items) {
    const place = show.effectivePlace;
    if (!place || !hasCoords(place)) {
      unmapped++;
      continue;
    }
    const point = points.get(place.id) ?? { place, shows: [] };
    point.shows.push(show);
    points.set(place.id, point);
  }
  return { points: [...points.values()], unmapped };
}
