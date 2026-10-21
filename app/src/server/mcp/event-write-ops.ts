// Write-side handlers for the event MCP tools. Event, show, and place writes
// go through the calendar stores; only create_event touches note content, and
// it does so through the connector's createNote.
import { prisma } from "~/server/db";
import type {
  EventPatch,
  OccurrenceInput,
  OccurrencePatch,
  PlaceInput,
  RepeatOccurrencesInput,
} from "~/lib/events/schemas";
import { effectiveDecision, type EventDecision } from "~/lib/events/types";
import {
  addOccurrences,
  addRepeatingOccurrences,
  deleteOccurrence,
  getNoteEvent,
  updateOccurrence,
  upsertNoteEvent,
} from "~/server/calendar/event-store";
import { geocodePlace, type GeocodeResult } from "~/server/calendar/geocode";
import {
  findOrCreatePlace,
  getPlace,
  updatePlace,
} from "~/server/calendar/place-store";
import type { Place } from "~/lib/events/types";
import {
  applyRowPatch,
  attachNotes,
} from "~/services/collections/collections.server";
import {
  findEventDuplicates,
  getEventDetails,
  resolveCollection,
} from "./event-read-ops";
import { rowPatchByName } from "./event-row-values";
import { ConnectorError, type ConnectorContext } from "./notes-shared";
import { createNote } from "./notes-write";

const LOG_PREFIX = "[mcp-events]";

/** Store "not found" errors become refusals the agent can act on. */
async function store<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message))
      throw new ConnectorError("not_found", error.message);
    if (error instanceof Error && (error as { code?: string }).code === "P2025")
      throw new ConnectorError("not_found", "Record not found");
    throw error;
  }
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
export async function upsertPlace(input: UpsertPlaceInput) {
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
async function resolveEventPlace(args: PlaceArgs) {
  if (args.placeId) {
    if (!(await getPlace(args.placeId)))
      throw new ConnectorError(
        "not_found",
        `No place ${args.placeId}. Use list_places or upsert_place.`,
      );
    return { placeId: args.placeId };
  }
  if (args.placeId === null) return { placeId: null };
  if (!args.place) return {};
  const result = await upsertPlace({ ...args.place, update: false });
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
      `Unknown placeId ${missing.join(", ")}. Use list_places or upsert_place.`,
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
    properties?: Record<string, unknown>;
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
      `Nothing was created. This looks like an existing event:\n${list}\nUse get_event, then add_shows or update_event. Pass allowDuplicate: true only if it is really a different event.`,
    );
  }

  // Validate everything that can fail before creating the note.
  const collection = input.collection
    ? await resolveCollection(input.collection)
    : null;
  if (input.properties && Object.keys(input.properties).length && !collection)
    throw new ConnectorError("invalid", "properties need a collection.");
  const rowPatch =
    collection && input.properties
      ? await rowPatchByName(collection.id, input.properties)
      : null;
  await checkShowPlaces([
    ...(input.shows ?? []),
    ...(input.repeat ? [input.repeat.show] : []),
  ]);
  const place = await resolveEventPlace(input);

  const note = await createNote(ctx, {
    title: input.title,
    path: input.path,
    markdown: input.markdown?.trim() ? input.markdown : defaultMarkdown(input),
    idempotencyKey: input.idempotencyKey,
  });
  if (note.deduplicated) {
    console.info(`${LOG_PREFIX} create_event replayed ${note.id}`);
    return { ...(await getEventDetails(ctx, note.id)), replayed: true };
  }
  if (collection) {
    await attachNotes(collection.id, [note.id]);
    if (rowPatch && Object.keys(rowPatch).length)
      await applyRowPatch(collection.id, note.id, rowPatch);
  }
  await upsertNoteEvent(note.id, {
    url: input.url,
    summary: input.summary,
    ...(place.placeId !== undefined ? { placeId: place.placeId } : {}),
    decision: input.decision,
    decisionNote: input.decisionNote,
  });
  await writeShows(note.id, input);
  console.info(`${LOG_PREFIX} created event ${note.id}`);
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
  const place = await resolveEventPlace(input);
  await store(() =>
    upsertNoteEvent(noteId, {
      url,
      summary,
      decision,
      decisionNote,
      ...(place.placeId !== undefined ? { placeId: place.placeId } : {}),
    }),
  );
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
  const before = new Set(
    (await getNoteEvent(input.noteId))?.occurrences.map((o) => o.id) ?? [],
  );
  await store(() => writeShows(input.noteId, input));
  const details = await getEventDetails(ctx, input.noteId);
  const added = details.shows.filter((s) => !before.has(s.occurrenceId));
  return {
    noteId: input.noteId,
    added,
    addedCount: added.length,
    totalShows: details.shows.length,
  };
}

async function eventDecisionOf(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { decision: true, docId: true },
  });
  return event ?? { decision: "unreviewed" as const, docId: null };
}

export async function updateShow(
  input: OccurrencePatch & { occurrenceId: string },
) {
  const { occurrenceId, ...patch } = input;
  if (patch.placeId) await checkShowPlaces([patch]);
  const show = await store(() => updateOccurrence(occurrenceId, patch));
  const event = await eventDecisionOf(show.eventId);
  return {
    ...show,
    noteId: event.docId,
    effectiveDecision: effectiveDecision(show.decision, event.decision),
  };
}

export async function removeShow(input: { occurrenceId: string }) {
  await store(() => deleteOccurrence(input.occurrenceId));
  return { removed: input.occurrenceId };
}

export type SetDecisionInput = {
  noteId?: string;
  occurrenceId?: string;
  decision: EventDecision;
  note?: string | null;
};

/**
 * Sets the event-level decision (noteId) or one show's decision
 * (occurrenceId). The two levels never write each other.
 */
export async function setDecision(
  ctx: ConnectorContext,
  input: SetDecisionInput,
) {
  if (Boolean(input.noteId) === Boolean(input.occurrenceId))
    throw new ConnectorError(
      "invalid",
      "Pass exactly one of noteId (event decision) or occurrenceId (show decision).",
    );
  const notePatch =
    input.note !== undefined ? { decisionNote: input.note } : {};
  if (input.occurrenceId) {
    const show = await updateShow({
      occurrenceId: input.occurrenceId,
      decision: input.decision,
      ...notePatch,
    });
    return {
      target: "show",
      occurrenceId: show.id,
      noteId: show.noteId,
      showDecision: show.decision,
      decisionNote: show.decisionNote,
      effectiveDecision: show.effectiveDecision,
    };
  }
  const noteId = input.noteId!;
  if (!(await getNoteEvent(noteId)))
    throw new ConnectorError(
      "not_found",
      `Note ${noteId} has no event details. Use update_event first.`,
    );
  await upsertNoteEvent(noteId, { decision: input.decision, ...notePatch });
  const details = await getEventDetails(ctx, noteId);
  return {
    target: "event",
    noteId,
    eventDecision: details.decision,
    decisionNote: details.decisionNote,
    shows: details.shows.map((s) => ({
      occurrenceId: s.occurrenceId,
      when: s.when,
      showDecision: s.decision,
      effectiveDecision: s.effectiveDecision,
    })),
  };
}
