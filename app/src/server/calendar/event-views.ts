// Read models for the /events pages: shows for a date window with the URL
// filters applied, and places with their upcoming show counts.
import { monthGrid } from "~/lib/collections/group";
import {
  listStartDate,
  matchesShowFilters,
  parseMonth,
} from "~/lib/events/filters";
import {
  addDays,
  instantToWallClock,
  wallClockToInstant,
} from "~/lib/events/time";
import { DEFAULT_TIME_ZONE, type PlaceKind } from "~/lib/events/types";
import type {
  PlaceWithCounts,
  ShowsView,
  ShowsViewInput,
} from "~/lib/events/view-types";
import { listOccurrences } from "./event-store";
import { listPlaces } from "./place-store";

const localToday = () => instantToWallClock(new Date(), DEFAULT_TIME_ZONE).date;

const startOf = (date: string) =>
  wallClockToInstant(date, "00:00", DEFAULT_TIME_ZONE).toISOString();

export async function listShowsView(input: ShowsViewInput): Promise<ShowsView> {
  const today = localToday();
  let from: string;
  let to: string | undefined;
  const month = parseMonth(input.month, today);
  if (input.calendar) {
    const weeks = monthGrid(month, today);
    from = startOf(weeks[0]![0]!.date);
    to = startOf(addDays(weeks[5]![6]!.date, 1));
  } else {
    from = startOf(listStartDate(today, input.past));
  }
  const collectionId =
    input.collection !== "all" && input.collection !== "loose"
      ? input.collection
      : undefined;
  const rows = await listOccurrences({
    from,
    to,
    collectionId,
    decisions: input.decisions.length ? input.decisions : undefined,
    includeCancelled: true,
    limit: 2000,
  });
  return {
    today,
    month,
    items: rows.filter((r) => matchesShowFilters(r, input)),
  };
}

export async function listPlacesWithCounts(input: {
  kind?: PlaceKind;
  search?: string;
  refresh?: number;
}): Promise<PlaceWithCounts[]> {
  const [places, upcoming] = await Promise.all([
    listPlaces({ kind: input.kind, search: input.search }),
    listOccurrences({ from: startOf(localToday()), limit: 2000 }),
  ]);
  const counts = new Map<string, number>();
  for (const show of upcoming) {
    const id = show.effectivePlace?.id;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return places.map((p) => ({ ...p, upcomingCount: counts.get(p.id) ?? 0 }));
}
