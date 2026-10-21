// Write-side handlers for the event and place MCP tools. Event, show, and
// place writes go through the calendar stores; only events_create touches note
// content, and it does so through the connector's createNote. Every write is
// logged as an `event.*` activity and refreshes open event views.
import { prisma } from "~/server/db";
import type {
  EventPatch,
  OccurrenceInput,
  OccurrencePatch,
  PlaceInput,
  RepeatOccurrencesInput,
} from "~/lib/events/schemas";
import type { EventDecision } from "~/lib/events/types";
import {
  addOccurrences,
  addRepeatingOccurrences,
  getNoteEvent,
  updateOccurrence,
  upsertNoteEvent,
} from "~/server/calendar/event-store";
import { logActionEvent } from "~/server/events/action-events";
import { publishAppChange } from "~/server/note-events";
import { geocodePlace, type GeocodeResult } from "~/server/calendar/geocode";
import {
  findOrCreatePlace,
  getPlace,
  updatePlace,
} from "~/server/calendar/place-store";
import type { Place } from "~/lib/events/types";
import { attachNotes } from "~/services/collections/collections.server";
import {
  checkRowValues,
  resolveCollection,
  setRowValues,
} from "./collections-agent";
import {
  findEventDuplicates,
  getEventDetails,
  showView,
} from "./event-read-ops";
import {
  agentContext,
  ConnectorError,
  requireNotes,
  type ConnectorContext,
} from "./shared";
import { createNote } from "./notes-write";

/** Logs an agent's event or place write and refreshes open event views. */
async function recordChange(
  ctx: ConnectorContext,
  eventType: string,
  input: {
    entityId: string;
    noteId?: string | null;
    payload: Record<string, string | number | null>;
  },
) {
  await logActionEvent({
    eventType,
    entityType: eventType.startsWith("event.place") ? "place" : "event",
    entityId: input.entityId,
    relatedDocId: input.noteId ?? null,
    payload: input.payload,
    context: agentContext(ctx),
  });
  publishAppChange("events", input.noteId ? [input.noteId] : null);
}

type GeocodeReport = {
  status: "found" | "failed" | "skipped";
  message: string;
};

const reportOf = (result: GeocodeResult): GeocodeReport =>
  result.ok
    ? {
        status: "found",
        message: `Geocoded "${result.query}" → ${result.latitude}, ${result.longitude}`,
      }
    : { status: "failed", message: `${result.reason}; coordinates left empty` };

async function geocodeInto(
  place: Place,
): Promise<{ place: Place; geocode: GeocodeReport }> {
  if (place.latitude !== null && place.longitude !== null)
    return {
      place,
      geocode: { status: "skipped", message: "Place already has coordinates" },
    };
  const result = await geocodePlace(place);
  if (!result.ok) return { place, geocode: reportOf(result) };
  const updated = await updatePlace(place.id, {
    latitude: result.latitude,
    longitude: result.longitude,
  });
  return { place: updated, geocode: reportOf(result) };
}

export type UpsertPlaceInput = PlaceInput & {
  update?: boolean;
  geocode?: boolean;
};

/** Finds a place by normalized name + city or creates it; optionally patches and geocodes. */
export async function upsertPlace(
  ctx: ConnectorContext,
  input: UpsertPlaceInput,
) {
  const { update, geocode, ...fields } = input;
  const found = await findOrCreatePlace(fields);
  let place = found.place;
  let updated = false;
  if (!found.created && update) {
    const patch = Object.fromEntries(
      Object.entries(fields).filter(
        ([key, v]) => v !== undefined && key !== "name",
      ),
    );
    if (Object.keys(patch).length) {
      place = await updatePlace(place.id, patch);
      updated = true;
    }
  }
  const geo = geocode ? await geocodeInto(place) : null;
  if (found.created || updated || geo?.geocode.status === "found") {
    await recordChange(
      ctx,
      found.created ? "event.place_created" : "event.place_updated",
      {
        entityId: place.id,
        payload: { name: place.name, city: place.city ?? null },
      },
    );
  }
  return {
    place: geo?.place ?? place,
    created: found.created,
    updated,
    ...(geo ? { geocode: geo.geocode } : {}),
    ...(!found.created && !update
      ? {
          note: "An existing place matched; pass update: true to change its fields.",
        }
      : {}),
  };
}

type PlaceArgs = {
  placeId?: string | null;
  place?: PlaceInput & { geocode?: boolean };
};

/** The place id an event should use: an existing id or a found/created place. */
async function resolveEventPlace(ctx: ConnectorContext, args: PlaceArgs) {
  if (args.placeId) {
    if (!(await getPlace(args.placeId)))
      throw new ConnectorError(
        "not_found",
        `No place ${args.placeId}. Use places_list or places_upsert.`,
      );
    return { placeId: args.placeId };
  }
  if (args.placeId === null) return { placeId: null };
  if (!args.place) return {};
  const result = await upsertPlace(ctx, { ...args.place, update: false });
  return {
    placeId: result.place.id,
    placeResult: {
      id: result.place.id,
      name: result.place.name,
      created: result.created,
      ...(result.geocode ? { geocode: result.geocode } : {}),
    },
  };
}

/** Rejects shows that point at places that do not exist. */
async function checkShowPlaces(shows: Array<{ placeId?: string | null }>) {
  const ids = [
    ...new Set(
      shows.map((s) => s.placeId).filter((id): id is string => Boolean(id)),
    ),
  ];
  if (!ids.length) return;
  const found = await prisma.place.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const known = new Set(found.map((p) => p.id));
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length)
    throw new ConnectorError(
      "not_found",
      `Unknown placeId ${missing.join(", ")}. Use places_list or places_upsert.`,
    );
}

type ShowArgs = { shows?: OccurrenceInput[]; repeat?: RepeatOccurrencesInput };

async function writeShows(noteId: string, args: ShowArgs) {
  if (args.shows?.length) await addOccurrences(noteId, args.shows);
  if (args.repeat) await addRepeatingOccurrences(noteId, args.repeat);
}

export type CreateEventInput = PlaceArgs &
  ShowArgs & {
    title: string;
    path?: string;
    markdown?: string;
    idempotencyKey?: string;
    collection?: string;
    values?: Record<string, unknown>;
    url?: string;
    summary?: string;
    decision?: EventDecision;
    decisionNote?: string;
    allowDuplicate?: boolean;
  };

const defaultMarkdown = (input: CreateEventInput) =>
  [input.summary?.trim(), input.url?.trim() ? `<${input.url.trim()}>` : null]
    .filter(Boolean)
    .join("\n\n") || input.title;

export async function createEvent(
  ctx: ConnectorContext,
  input: CreateEventInput,
) {
  const dates = [
    ...(input.shows ?? []).map((s) => s.date),
    ...(input.repeat ? [input.repeat.show.date] : []),
  ];
  const duplicates = await findEventDuplicates(ctx, {
    title: input.title,
    url: input.url,
    dates,
  });
  if (duplicates.exists && !input.allowDuplicate) {
    const list = duplicates.candidates
      .map(
        (c) =>
          `- ${c.title} (noteId ${c.noteId}, ${c.confidence}): ${c.reasons.join("; ")}`,
      )
      .join("\n");
    throw new ConnectorError(
      "duplicate",
      `Nothing was written. This looks like an existing event:\n${list}\nUse events_get, then events_add_shows or events_update. Pass allowDuplicate: true only if it is really a different event.`,
    );
  }

  // Validate everything that can fail before creating the note.
  const collection = input.collection
    ? await resolveCollection(input.collection)
    : null;
  const values =
    input.values && Object.keys(input.values).length ? input.values : null;
  if (values && !collection)
    throw new ConnectorError("invalid", "values need a collection.");
  if (collection && values) await checkRowValues(collection.id, [values]);
  await checkShowPlaces([
    ...(input.shows ?? []),
    ...(input.repeat ? [input.repeat.show] : []),
  ]);
  const place = await resolveEventPlace(ctx, input);

  const note = await createNote(ctx, {
    title: input.title,
    path: input.path,
    markdown: input.markdown?.trim() ? input.markdown : defaultMarkdown(input),
    idempotencyKey: input.idempotencyKey,
  });
  if (note.deduplicated) {
    return { ...(await getEventDetails(ctx, note.id)), replayed: true };
  }
  if (collection) {
    await attachNotes(collection.id, [note.id]);
    if (values) await setRowValues(collection.id, [note.id], values);
    publishAppChange("collections", [collection.id]);
  }
  await upsertNoteEvent(note.id, {
    url: input.url,
    summary: input.summary,
    ...(place.placeId !== undefined ? { placeId: place.placeId } : {}),
    decision: input.decision,
    decisionNote: input.decisionNote,
  });
  await writeShows(note.id, input);
  await recordChange(ctx, "event.created", {
    entityId: note.id,
    noteId: note.id,
    payload: { title: input.title, showCount: dates.length },
  });
  return {
    ...(await getEventDetails(ctx, note.id)),
    ...(place.placeResult ? { placeResult: place.placeResult } : {}),
    ...(duplicates.exists ? { allowedDuplicates: duplicates.candidates } : {}),
  };
}

export type UpdateEventInput = EventPatch & PlaceArgs & { noteId: string };

/** Patches event fields; makes the note an event when it is not one yet. */
export async function updateEvent(
  ctx: ConnectorContext,
  input: UpdateEventInput,
) {
  const { noteId, url, summary, decision, decisionNote } = input;
  await requireNotes([noteId]);
  const place = await resolveEventPlace(ctx, input);
  await upsertNoteEvent(noteId, {
    url,
    summary,
    decision,
    decisionNote,
    ...(place.placeId !== undefined ? { placeId: place.placeId } : {}),
  });
  const fieldsChanged = Object.entries({
    url,
    summary,
    decision,
    decisionNote,
    place: place.placeId,
  })
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key)
    .join(", ");
  await recordChange(ctx, "event.updated", {
    entityId: noteId,
    noteId,
    payload: { fieldsChanged, decision: decision ?? null },
  });
  return {
    ...(await getEventDetails(ctx, noteId)),
    ...(place.placeResult ? { placeResult: place.placeResult } : {}),
  };
}

export async function addShows(
  ctx: ConnectorContext,
  input: ShowArgs & { noteId: string },
) {
  if (!input.shows?.length && !input.repeat)
    throw new ConnectorError("invalid", "Pass shows and/or repeat.");
  await checkShowPlaces([
    ...(input.shows ?? []),
    ...(input.repeat ? [input.repeat.show] : []),
  ]);
  await requireNotes([input.noteId]);
  const before = new Set(
    (await getNoteEvent(input.noteId))?.occurrences.map((o) => o.id) ?? [],
  );
  await writeShows(input.noteId, input);
  const details = await getEventDetails(ctx, input.noteId);
  const added = details.shows.filter((s) => !before.has(s.showId));
  await recordChange(ctx, "event.shows_added", {
    entityId: input.noteId,
    noteId: input.noteId,
    payload: { showCount: added.length },
  });
  return {
    noteId: input.noteId,
    appUrl: details.appUrl,
    added,
    totalShows: details.shows.length,
  };
}

async function eventOf(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { decision: true, docId: true },
  });
  return event ?? { decision: "unreviewed" as const, docId: null };
}

/** Patches one show; the result reads like a show from events_get. */
export async function updateShow(
  ctx: ConnectorContext,
  input: OccurrencePatch & { showId: string },
) {
  const { showId, ...patch } = input;
  if (patch.placeId) await checkShowPlaces([patch]);
  const show = await updateOccurrence(showId, patch);
  const event = await eventOf(show.eventId);
  await recordChange(ctx, "event.show_updated", {
    entityId: showId,
    noteId: event.docId,
    payload: {
      fieldsChanged: Object.keys(patch).join(", "),
      decision: patch.decision ?? null,
      status: patch.status ?? null,
    },
  });
  return { noteId: event.docId, ...showView(show, event.decision) };
}
