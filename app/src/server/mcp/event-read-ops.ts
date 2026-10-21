// Read-side handlers for the event MCP tools: upcoming shows, one event,
// duplicate checks, places, and feeds. Rows stay compact for agents.
import { prisma } from "~/server/db";
import { findDuplicateMatches, type DuplicateQuery } from "~/lib/events/dedupe";
import { formatShowWhen } from "~/lib/events/format";
import {
  addDays,
  instantToWallClock,
  wallClockToInstant,
} from "~/lib/events/time";
import {
  DEFAULT_TIME_ZONE,
  effectiveDecision,
  type EventDecision,
  type Occurrence,
  type PlaceKind,
} from "~/lib/events/types";
import {
  getNoteEvent,
  listEvents,
  listOccurrences,
  localFields,
} from "~/server/calendar/event-store";
import {
  findPlacesByName,
  getPlace,
  listPlaces,
} from "~/server/calendar/place-store";
import { collectionTextForNotes } from "~/services/collections/collection-text";
import { resolveCollection } from "./collections-agent";
import { ConnectorError, noteAppUrl, type ConnectorContext } from "./shared";

const today = () => instantToWallClock(new Date(), DEFAULT_TIME_ZONE).date;
const startOfLocalDay = (date: string) =>
  wallClockToInstant(date, "00:00", DEFAULT_TIME_ZONE).toISOString();

/** A place by id, or by name when exactly one matches. */
export async function resolvePlaceRef(ref: string) {
  const byId = await getPlace(ref);
  if (byId) return byId;
  const exact = await findPlacesByName(ref);
  const matches = exact.length ? exact : await listPlaces({ search: ref });
  if (matches.length === 1) return matches[0]!;
  if (!matches.length)
    throw new ConnectorError(
      "not_found",
      `No place "${ref}". Use places_list.`,
    );
  throw new ConnectorError(
    "invalid",
    `Several places match "${ref}"; pass one id: ${matches
      .slice(0, 10)
      .map((p) => `${p.name} (${p.city ?? "?"}) ${p.id}`)
      .join("; ")}`,
  );
}

type ShowLike = Pick<
  Occurrence,
  "startsAt" | "endsAt" | "allDay" | "timeConfirmed" | "timeZone"
>;

const whenOf = (show: ShowLike) =>
  formatShowWhen(show, Number(today().slice(0, 4)));

/** One show as every event tool returns it. */
export const showView = (o: Occurrence, eventDecision: EventDecision) => ({
  showId: o.id,
  ...localFields(o),
  when: whenOf(o),
  timeConfirmed: o.timeConfirmed,
  label: o.label,
  place: o.place,
  ticketStatus: o.ticketStatus,
  status: o.status,
  decision: o.decision,
  decisionNote: o.decisionNote,
  effectiveDecision: effectiveDecision(o.decision, eventDecision),
});

export type ListEventsInput = {
  from?: string;
  to?: string;
  collection?: string;
  decisions?: EventDecision[];
  place?: string;
  search?: string;
  includeCancelled?: boolean;
  limit?: number;
};

/** Upcoming shows as compact rows, oldest first. */
export async function listEventShows(
  ctx: ConnectorContext,
  input: ListEventsInput,
) {
  const collection = input.collection
    ? await resolveCollection(input.collection)
    : null;
  const place = input.place ? await resolvePlaceRef(input.place) : null;
  let docIds: string[] | undefined;
  if (input.search?.trim()) {
    docIds = (
      await listEvents({ search: input.search.trim(), limit: 500 })
    ).map((e) => e.docId);
    if (!docIds.length) return { shows: [], truncated: false };
  }
  // The store applies its take before the decision filter, so ask for a wide
  // page and trim here.
  const rows = await listOccurrences({
    from: startOfLocalDay(input.from ?? today()),
    ...(input.to ? { to: startOfLocalDay(addDays(input.to, 1)) } : {}),
    ...(collection ? { collectionId: collection.id } : {}),
    ...(place ? { placeId: place.id } : {}),
    ...(docIds ? { docIds } : {}),
    ...(input.decisions?.length ? { decisions: input.decisions } : {}),
    includeCancelled: input.includeCancelled ?? false,
    limit: 2000,
  });
  const limit = input.limit ?? 50;
  const shows = rows.slice(0, limit).map((o) => ({
    showId: o.id,
    noteId: o.docId,
    title: o.title,
    when: whenOf(o),
    date: localFields(o).date,
    label: o.label,
    place: o.effectivePlace?.name ?? null,
    decision: o.effectiveDecision,
    showDecision: o.decision,
    eventDecision: o.eventDecision,
    status: o.status,
    url: o.eventUrl,
    appUrl: noteAppUrl(ctx, o.docId),
  }));
  return {
    timeZone: DEFAULT_TIME_ZONE,
    shows,
    truncated: rows.length > limit,
  };
}

/** One note's event details, every show in local terms, and its collection. */
export async function getEventDetails(ctx: ConnectorContext, noteId: string) {
  const doc = await prisma.doc.findUnique({
    where: { id: noteId },
    select: { id: true, title: true, collectionId: true },
  });
  if (!doc) throw new ConnectorError("not_found", `No note ${noteId}.`);
  const event = await getNoteEvent(noteId);
  if (!event)
    throw new ConnectorError(
      "not_found",
      `Note ${noteId} has no event details. Use events_update or events_add_shows to make it an event.`,
    );
  const collection = doc.collectionId
    ? (await collectionTextForNotes([noteId]))[noteId]
    : undefined;
  return {
    noteId: doc.id,
    title: doc.title,
    appUrl: noteAppUrl(ctx, doc.id),
    collection: doc.collectionId
      ? {
          id: doc.collectionId,
          name: collection?.collection ?? null,
          properties: collection?.properties ?? {},
        }
      : null,
    url: event.url,
    summary: event.summary,
    place: event.place,
    decision: event.decision,
    decisionNote: event.decisionNote,
    shows: event.occurrences.map((o) => showView(o, event.decision)),
  };
}

/** Every event as a dedupe candidate: title, URL, and local show dates. */
async function loadDuplicateCandidates() {
  const rows = await prisma.event.findMany({
    select: {
      id: true,
      docId: true,
      url: true,
      doc: { select: { title: true } },
      occurrences: { select: { startsAt: true, timeZone: true } },
    },
    take: 5000,
  });
  return rows.map((r) => ({
    eventId: r.id,
    noteId: r.docId,
    title: r.doc.title,
    url: r.url,
    dates: r.occurrences.map(
      (o) => instantToWallClock(o.startsAt, o.timeZone).date,
    ),
  }));
}

export async function findEventDuplicates(
  ctx: ConnectorContext,
  query: DuplicateQuery,
) {
  if (!query.title?.trim() && !query.url?.trim())
    throw new ConnectorError("invalid", "Pass a title and/or url to check.");
  const matches = findDuplicateMatches(query, await loadDuplicateCandidates());
  const candidates = matches.slice(0, 10).map(({ candidate, match }) => ({
    noteId: candidate.noteId,
    title: candidate.title,
    url: candidate.url,
    appUrl: noteAppUrl(ctx, candidate.noteId),
    confidence: match.confidence,
    reasons: match.reasons,
  }));
  return {
    exists: candidates.length > 0,
    recommendation: candidates.length
      ? "Review the candidates with events_get; add missing shows (events_add_shows) or patch the match (events_update) instead of creating another event."
      : "No likely match; events_create is reasonable.",
    candidates,
  };
}

export async function listPlacesCompact(input: {
  kind?: PlaceKind;
  search?: string;
  limit?: number;
}) {
  const places = await listPlaces(input);
  const limit = input.limit ?? 100;
  return {
    places: places.slice(0, limit).map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      address: p.address,
      latitude: p.latitude,
      longitude: p.longitude,
      url: p.url,
    })),
    truncated: places.length > limit,
  };
}

/** Feed names and rules. Tokens are secrets and never leave the server. */
export async function listFeedSummaries() {
  const feeds = await prisma.calendarFeed.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      decisions: true,
      pastDays: true,
      collection: { select: { id: true, name: true } },
      view: { select: { id: true, name: true } },
      entries: { select: { mode: true } },
    },
    orderBy: { name: "asc" },
  });
  return feeds.map((f) => {
    const included = f.entries.filter((e) => e.mode === "include").length;
    const excluded = f.entries.length - included;
    const parts = [
      f.collection
        ? `rows of "${f.collection.name}"${f.view ? ` matching view "${f.view.name}"` : ""}`
        : "no collection rule",
      f.decisions.length
        ? `decisions: ${f.decisions.join(", ")}`
        : "any decision",
      `${f.pastDays} past days`,
      ...(included ? [`+${included} included`] : []),
      ...(excluded ? [`${excluded} excluded`] : []),
    ];
    return {
      id: f.id,
      name: f.name,
      description: f.description,
      collection: f.collection,
      view: f.view,
      decisions: f.decisions,
      pastDays: f.pastDays,
      rule: parts.join("; "),
    };
  });
}
