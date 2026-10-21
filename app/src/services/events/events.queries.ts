import { query } from "@solidjs/router";
import {
  occurrenceListSchema,
  type OccurrenceListInput,
} from "~/lib/events/schemas";
import type { PlaceKind } from "~/lib/events/types";
import {
  getNoteEvent,
  listEvents,
  listOccurrences,
} from "~/server/calendar/event-store";
import { getPlace, listPlaces } from "~/server/calendar/place-store";

/** The event details and shows on one note, or null when it is not an event. */
export const fetchNoteEvent = query(async (docId: string) => {
  "use server";
  return getNoteEvent(docId);
}, "events-note");

export const fetchOccurrences = query(async (input: OccurrenceListInput) => {
  "use server";
  return listOccurrences(occurrenceListSchema.parse(input ?? {}));
}, "events-occurrences");

export const fetchEventList = query(
  async (input: { search?: string; limit?: number }) => {
    "use server";
    return listEvents(input ?? {});
  },
  "events-list",
);

export const fetchPlaces = query(
  async (input: { kind?: PlaceKind; search?: string }) => {
    "use server";
    return listPlaces(input ?? {});
  },
  "events-places",
);

export const fetchPlace = query(async (id: string) => {
  "use server";
  return getPlace(id);
}, "events-place");
