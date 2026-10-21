// Filters shared by the /events list, calendar, and map. They live in the URL
// (`?collection=&decision=a,b&past=1&q=&month=`) so links are shareable and
// the server renders the same rows the browser will.
import { addDays } from "./time";
import {
  EVENT_DECISIONS,
  PLACE_KINDS,
  type EventDecision,
  type OccurrenceListItem,
  type PlaceKind,
} from "./types";
import type { OptionColor } from "~/lib/collections/types";

/** `all`, `loose` (notes outside any collection), or a collection id. */
export type CollectionFilter = string;

export type EventsFilters = {
  collection: CollectionFilter;
  decisions: EventDecision[];
  /** Also show the past 30 days. */
  past: boolean;
  q: string;
};

export const PAST_DAYS = 30;

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

const isDecision = (v: string): v is EventDecision =>
  (EVENT_DECISIONS as readonly string[]).includes(v);

export function parseEventsFilters(params: RawParams): EventsFilters {
  const decisions = first(params.decision)
    .split(",")
    .map((d) => d.trim())
    .filter(isDecision);
  return {
    collection: first(params.collection) || "all",
    decisions: EVENT_DECISIONS.filter((d) => decisions.includes(d)),
    past: first(params.past) === "1",
    q: first(params.q),
  };
}

/** Search-param patch for `setSearchParams`; defaults clear their key. */
export function filtersToParams(filters: Partial<EventsFilters>) {
  const out: Record<string, string | undefined> = {};
  if ("collection" in filters)
    out.collection =
      filters.collection && filters.collection !== "all"
        ? filters.collection
        : undefined;
  if ("decisions" in filters)
    out.decision = filters.decisions?.length
      ? filters.decisions.join(",")
      : undefined;
  if ("past" in filters) out.past = filters.past ? "1" : undefined;
  if ("q" in filters) out.q = filters.q?.trim() || undefined;
  return out;
}

export const hasActiveFilters = (f: EventsFilters) =>
  f.collection !== "all" || f.decisions.length > 0 || f.past || f.q !== "";

/** `YYYY-MM` from `?month=`, else the month holding `today`. */
export function parseMonth(
  value: string | string[] | undefined,
  today: string,
) {
  const raw = first(value);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : today.slice(0, 7);
}

/** Collection and title filters the occurrence store does not apply itself. */
export function matchesShowFilters(
  item: Pick<OccurrenceListItem, "collectionId" | "title">,
  filters: Pick<EventsFilters, "collection" | "q">,
) {
  if (filters.collection === "loose" && item.collectionId) return false;
  const q = filters.q.toLowerCase();
  return !q || item.title.toLowerCase().includes(q);
}

/** First local date the upcoming list covers. */
export const listStartDate = (today: string, past: boolean) =>
  past ? addDays(today, -PAST_DAYS) : today;

export const parsePlaceKind = (
  value: string | string[] | undefined,
): PlaceKind | undefined => {
  const raw = first(value);
  return (PLACE_KINDS as readonly string[]).includes(raw)
    ? (raw as PlaceKind)
    : undefined;
};

/** Chip ink per effective decision; booked reads as "go", rejected as "no". */
export const DECISION_COLORS: Record<EventDecision, OptionColor> = {
  unreviewed: "gray",
  interested: "blue",
  tentative: "yellow",
  booked: "green",
  skipped: "brown",
  rejected: "red",
};
