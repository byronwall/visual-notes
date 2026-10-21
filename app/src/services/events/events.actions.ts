import { action, json } from "@solidjs/router";
import { z } from "zod";
import {
  eventPatchSchema,
  occurrenceInputSchema,
  occurrencePatchSchema,
  placeInputSchema,
  placePatchSchema,
  repeatInputSchema,
} from "~/lib/events/schemas";
import {
  addOccurrences,
  addRepeatingOccurrences,
  deleteNoteEvent,
  deleteOccurrence,
  updateOccurrence,
  upsertNoteEvent,
} from "~/server/calendar/event-store";
import {
  createPlace,
  deletePlace,
  updatePlace,
} from "~/server/calendar/place-store";
import {
  fetchEventList,
  fetchNoteEvent,
  fetchOccurrences,
  fetchPlace,
  fetchPlaces,
} from "./events.queries";

const id = z.string().min(1);

// Event edits refresh every event read; they are few and cheap.
const EVENT_KEYS = [
  fetchNoteEvent.key,
  fetchOccurrences.key,
  fetchEventList.key,
];
const PLACE_KEYS = [fetchPlaces.key, fetchPlace.key, ...EVENT_KEYS];

export const saveNoteEvent = action(
  async (payload: {
    docId: string;
    patch: z.infer<typeof eventPatchSchema>;
  }) => {
    "use server";
    const event = await upsertNoteEvent(
      id.parse(payload.docId),
      eventPatchSchema.parse(payload.patch ?? {}),
    );
    return json(event, { revalidate: EVENT_KEYS });
  },
  "events-save-note-event",
);

export const removeNoteEvent = action(async (docId: string) => {
  "use server";
  await deleteNoteEvent(id.parse(docId));
  return json({ ok: true }, { revalidate: EVENT_KEYS });
}, "events-remove-note-event");

export const createOccurrences = action(
  async (payload: {
    docId: string;
    shows: z.infer<typeof occurrenceInputSchema>[];
  }) => {
    "use server";
    const shows = z
      .array(occurrenceInputSchema)
      .min(1)
      .max(104)
      .parse(payload.shows);
    const event = await addOccurrences(id.parse(payload.docId), shows);
    return json(event, { revalidate: EVENT_KEYS });
  },
  "events-create-occurrences",
);

export const createRepeatingOccurrences = action(
  async (payload: {
    docId: string;
    repeat: z.infer<typeof repeatInputSchema>;
  }) => {
    "use server";
    const event = await addRepeatingOccurrences(
      id.parse(payload.docId),
      repeatInputSchema.parse(payload.repeat),
    );
    return json(event, { revalidate: EVENT_KEYS });
  },
  "events-create-repeating",
);

export const saveOccurrence = action(
  async (payload: {
    id: string;
    patch: z.infer<typeof occurrencePatchSchema>;
  }) => {
    "use server";
    const occurrence = await updateOccurrence(
      id.parse(payload.id),
      occurrencePatchSchema.parse(payload.patch),
    );
    return json(occurrence, { revalidate: EVENT_KEYS });
  },
  "events-save-occurrence",
);

export const removeOccurrence = action(async (occurrenceId: string) => {
  "use server";
  await deleteOccurrence(id.parse(occurrenceId));
  return json({ ok: true }, { revalidate: EVENT_KEYS });
}, "events-remove-occurrence");

export const addPlace = action(
  async (payload: z.infer<typeof placeInputSchema>) => {
    "use server";
    const place = await createPlace(placeInputSchema.parse(payload));
    return json(place, { revalidate: PLACE_KEYS });
  },
  "events-add-place",
);

export const savePlace = action(
  async (payload: { id: string; patch: z.infer<typeof placePatchSchema> }) => {
    "use server";
    const place = await updatePlace(
      id.parse(payload.id),
      placePatchSchema.parse(payload.patch),
    );
    return json(place, { revalidate: PLACE_KEYS });
  },
  "events-save-place",
);

export const removePlace = action(async (placeId: string) => {
  "use server";
  await deletePlace(id.parse(placeId));
  return json({ ok: true }, { revalidate: PLACE_KEYS });
}, "events-remove-place");
