// Event and show persistence. Plain async functions so server actions, the
// iCal route, and MCP tools share one implementation.
import type { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import { expandRepeat } from "~/lib/events/recurrence";
import {
  occurrenceInputSchema,
  type EventPatch,
  type OccurrenceInput,
  type OccurrenceListInput,
  type OccurrencePatch,
  type RepeatOccurrencesInput,
} from "~/lib/events/schemas";
import {
  addDays,
  instantToWallClock,
  wallClockToInstant,
} from "~/lib/events/time";
import {
  DEFAULT_TIME_ZONE,
  effectiveDecision,
  type NoteEvent,
  type Occurrence,
  type OccurrenceListItem,
} from "~/lib/events/types";
import { mapPlaceSummary, PLACE_SUMMARY_SELECT } from "./place-store";

const LOG_PREFIX = "[event-store]";

export const OCCURRENCE_INCLUDE = {
  place: { select: PLACE_SUMMARY_SELECT },
} satisfies Prisma.EventOccurrenceInclude;

type OccurrenceRecord = Prisma.EventOccurrenceGetPayload<{
  include: typeof OCCURRENCE_INCLUDE;
}>;

export const EVENT_INCLUDE = {
  place: { select: PLACE_SUMMARY_SELECT },
  occurrences: { include: OCCURRENCE_INCLUDE, orderBy: { startsAt: "asc" } },
} satisfies Prisma.EventInclude;

type EventRecord = Prisma.EventGetPayload<{ include: typeof EVENT_INCLUDE }>;

export const mapOccurrence = (o: OccurrenceRecord): Occurrence => ({
  id: o.id,
  eventId: o.eventId,
  label: o.label,
  startsAt: o.startsAt.toISOString(),
  endsAt: o.endsAt?.toISOString() ?? null,
  allDay: o.allDay,
  timeConfirmed: o.timeConfirmed,
  timeZone: o.timeZone,
  placeId: o.placeId,
  place: o.place ? mapPlaceSummary(o.place) : null,
  ticketStatus: o.ticketStatus,
  status: o.status,
  decision: o.decision,
  decisionNote: o.decisionNote,
  sourceBlockId: o.sourceBlockId,
  sequence: o.sequence,
  updatedAt: o.updatedAt.toISOString(),
});

export const mapNoteEvent = (e: EventRecord): NoteEvent => ({
  id: e.id,
  docId: e.docId,
  url: e.url,
  summary: e.summary,
  placeId: e.placeId,
  place: e.place ? mapPlaceSummary(e.place) : null,
  decision: e.decision,
  decisionNote: e.decisionNote,
  occurrences: e.occurrences.map(mapOccurrence),
  updatedAt: e.updatedAt.toISOString(),
});

const blankToNull = (value: string | null | undefined) =>
  value === undefined ? undefined : value?.trim() || null;

/** Converts a local show to stored instants. */
export function resolveTimes(input: {
  date: string;
  time?: string | null;
  endDate?: string | null;
  endTime?: string | null;
  timeZone?: string;
}) {
  const timeZone = input.timeZone ?? DEFAULT_TIME_ZONE;
  const allDay = !input.time;
  const startsAt = wallClockToInstant(
    input.date,
    input.time ?? "00:00",
    timeZone,
  );
  let endsAt: Date | null = null;
  if (allDay) {
    if (input.endDate && input.endDate > input.date) {
      endsAt = wallClockToInstant(input.endDate, "00:00", timeZone);
    }
  } else if (input.endTime || input.endDate) {
    const endDate = input.endDate ?? input.date;
    endsAt = wallClockToInstant(
      endDate,
      input.endTime ?? input.time!,
      timeZone,
    );
    // An end time earlier than the start runs past midnight.
    if (endsAt <= startsAt && !input.endDate) {
      endsAt = wallClockToInstant(
        addDays(input.date, 1),
        input.endTime!,
        timeZone,
      );
    }
    if (endsAt <= startsAt) endsAt = null;
  }
  return { startsAt, endsAt, allDay, timeZone };
}

/** The stored show as local fields, the inverse of `resolveTimes`. */
export function localFields(
  o: Pick<Occurrence, "startsAt" | "endsAt" | "allDay" | "timeZone">,
) {
  const start = instantToWallClock(o.startsAt, o.timeZone);
  const end = o.endsAt ? instantToWallClock(o.endsAt, o.timeZone) : null;
  return {
    date: start.date,
    time: o.allDay ? null : start.time,
    endDate: end && end.date !== start.date ? end.date : null,
    endTime: o.allDay || !end ? null : end.time,
    timeZone: o.timeZone,
  };
}

async function requireDoc(docId: string) {
  const doc = await prisma.doc.findUnique({
    where: { id: docId },
    select: { id: true },
  });
  if (!doc) throw new Error("Note not found");
}

export async function getNoteEvent(docId: string): Promise<NoteEvent | null> {
  const event = await prisma.event.findUnique({
    where: { docId },
    include: EVENT_INCLUDE,
  });
  return event ? mapNoteEvent(event) : null;
}

/** Makes `docId` an event (idempotent) and applies `patch`. */
export async function upsertNoteEvent(
  docId: string,
  patch: EventPatch = {},
): Promise<NoteEvent> {
  await requireDoc(docId);
  const data = {
    url: blankToNull(patch.url),
    summary: blankToNull(patch.summary),
    placeId: patch.placeId,
    decision: patch.decision,
    decisionNote: blankToNull(patch.decisionNote),
  };
  const event = await prisma.event.upsert({
    where: { docId },
    create: { docId, ...data },
    update: data,
    include: EVENT_INCLUDE,
  });
  return mapNoteEvent(event);
}

/** Removes the event details and every show; the note itself stays. */
export async function deleteNoteEvent(docId: string) {
  await prisma.event.deleteMany({ where: { docId } });
}

function occurrenceData(input: OccurrenceInput) {
  const times = resolveTimes(input);
  return {
    ...times,
    timeConfirmed: input.timeConfirmed ?? true,
    label: blankToNull(input.label) ?? null,
    placeId: input.placeId ?? null,
    ticketStatus: blankToNull(input.ticketStatus) ?? null,
    status: input.status ?? "scheduled",
    decision: input.decision ?? "unreviewed",
    decisionNote: blankToNull(input.decisionNote) ?? null,
    sourceBlockId: input.sourceBlockId ?? null,
  } satisfies Omit<Prisma.EventOccurrenceUncheckedCreateInput, "eventId">;
}

/** Adds shows to a note, making it an event first when needed. */
export async function addOccurrences(docId: string, shows: OccurrenceInput[]) {
  const event = await upsertNoteEvent(docId);
  const parsed = shows.map((s) => occurrenceInputSchema.parse(s));
  await prisma.eventOccurrence.createMany({
    data: parsed.map((s) => ({ eventId: event.id, ...occurrenceData(s) })),
  });
  console.info(`${LOG_PREFIX} added ${parsed.length} shows to ${docId}`);
  return (await getNoteEvent(docId))!;
}

/** Expands a repeat rule into explicit shows, skipping dates already present. */
export async function addRepeatingOccurrences(
  docId: string,
  input: RepeatOccurrencesInput,
) {
  const { show } = input;
  const timeZone = show.timeZone ?? DEFAULT_TIME_ZONE;
  const first = resolveTimes({ ...show, timeZone });
  const durationMinutes = first.endsAt
    ? Math.round((first.endsAt.getTime() - first.startsAt.getTime()) / 60000)
    : null;
  const dates = expandRepeat({
    startDate: show.date,
    startTime: show.time ?? null,
    durationMinutes: first.allDay ? null : durationMinutes,
    timeZone,
    rule: input.rule,
    count: input.count,
    until: input.until,
  });
  const existing = await getNoteEvent(docId);
  // One show per local day: a repeat never doubles up a day that already has
  // a show, even when the existing show's time differs.
  const taken = new Set(
    existing?.occurrences.map(
      (o) => instantToWallClock(o.startsAt, o.timeZone).date,
    ) ?? [],
  );
  const shows = dates
    .filter((d) => !taken.has(d.date))
    .map((d) => {
      const end = d.endsAt ? instantToWallClock(d.endsAt, timeZone) : null;
      return {
        ...show,
        timeZone,
        date: d.date,
        endDate: end && end.date !== d.date ? end.date : null,
        endTime: end?.time ?? null,
      };
    });
  return addOccurrences(docId, shows);
}

const PUBLISHED_FIELDS = [
  "startsAt",
  "endsAt",
  "allDay",
  "timeConfirmed",
  "label",
  "placeId",
  "status",
] as const;

/** Updates one show; bumps its iCal SEQUENCE when published fields change. */
export async function updateOccurrence(
  id: string,
  patch: OccurrencePatch,
): Promise<Occurrence> {
  const current = await prisma.eventOccurrence.findUnique({
    where: { id },
    include: OCCURRENCE_INCLUDE,
  });
  if (!current) throw new Error("Show not found");
  const touchesTime =
    patch.date !== undefined ||
    patch.time !== undefined ||
    patch.endDate !== undefined ||
    patch.endTime !== undefined ||
    patch.timeZone !== undefined;
  const local = localFields(mapOccurrence(current));
  const times = touchesTime
    ? resolveTimes({
        ...local,
        ...patch,
        timeZone: patch.timeZone ?? local.timeZone,
      })
    : {};
  const data: Prisma.EventOccurrenceUncheckedUpdateInput = {
    ...times,
    ...(patch.timeConfirmed !== undefined
      ? { timeConfirmed: patch.timeConfirmed }
      : {}),
    ...(patch.label !== undefined ? { label: blankToNull(patch.label) } : {}),
    ...(patch.placeId !== undefined ? { placeId: patch.placeId } : {}),
    ...(patch.ticketStatus !== undefined
      ? { ticketStatus: blankToNull(patch.ticketStatus) }
      : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.decision !== undefined ? { decision: patch.decision } : {}),
    ...(patch.decisionNote !== undefined
      ? { decisionNote: blankToNull(patch.decisionNote) }
      : {}),
    ...(patch.sourceBlockId !== undefined
      ? { sourceBlockId: patch.sourceBlockId }
      : {}),
  };
  const changed = PUBLISHED_FIELDS.some((field) => {
    if (!(field in data)) return false;
    const next = data[field];
    const prev = current[field];
    return (
      (next instanceof Date ? next.getTime() : next) !==
      (prev instanceof Date ? prev.getTime() : prev)
    );
  });
  if (changed) data.sequence = { increment: 1 };
  const updated = await prisma.eventOccurrence.update({
    where: { id },
    data,
    include: OCCURRENCE_INCLUDE,
  });
  return mapOccurrence(updated);
}

export async function deleteOccurrence(id: string) {
  await prisma.eventOccurrence.delete({ where: { id } });
}

/** Shows across notes, oldest first, for lists, calendars, maps, and feeds. */
export async function listOccurrences(
  input: OccurrenceListInput = {},
): Promise<OccurrenceListItem[]> {
  const where: Prisma.EventOccurrenceWhereInput = {
    ...(input.from || input.to
      ? {
          startsAt: {
            ...(input.from ? { gte: new Date(input.from) } : {}),
            ...(input.to ? { lt: new Date(input.to) } : {}),
          },
        }
      : {}),
    ...(input.includeCancelled ? {} : { status: { not: "cancelled" } }),
    AND: [
      ...(input.placeId
        ? [
            {
              OR: [
                { placeId: input.placeId },
                { placeId: null, event: { placeId: input.placeId } },
              ],
            },
          ]
        : []),
      // Effective decision: the show's own, or the event's when unreviewed.
      // Filtered in SQL so `take` counts only matching shows.
      ...(input.decisions?.length
        ? [
            {
              OR: [
                { decision: { in: input.decisions } },
                {
                  decision: "unreviewed" as const,
                  event: { decision: { in: input.decisions } },
                },
              ],
            },
          ]
        : []),
    ],
    event: {
      ...(input.docIds ? { docId: { in: input.docIds } } : {}),
      ...(input.collectionId
        ? { doc: { collectionId: input.collectionId } }
        : {}),
    },
  };
  const rows = await prisma.eventOccurrence.findMany({
    where,
    include: {
      ...OCCURRENCE_INCLUDE,
      event: {
        select: {
          docId: true,
          url: true,
          summary: true,
          decision: true,
          place: { select: PLACE_SUMMARY_SELECT },
          doc: { select: { title: true, collectionId: true } },
        },
      },
    },
    orderBy: { startsAt: "asc" },
    take: input.limit ?? 500,
  });
  return rows.map((row): OccurrenceListItem => {
    const occurrence = mapOccurrence(row);
    const eventPlace = row.event.place
      ? mapPlaceSummary(row.event.place)
      : null;
    return {
      ...occurrence,
      docId: row.event.docId,
      title: row.event.doc.title,
      collectionId: row.event.doc.collectionId,
      eventDecision: row.event.decision,
      eventUrl: row.event.url,
      eventSummary: row.event.summary,
      effectivePlace: occurrence.place ?? eventPlace,
      effectiveDecision: effectiveDecision(
        occurrence.decision,
        row.event.decision,
      ),
    };
  });
}

export type EventListItem = {
  id: string;
  docId: string;
  title: string;
  collectionId: string | null;
  decision: NoteEvent["decision"];
  nextStartsAt: string | null;
  occurrenceCount: number;
};

/** Events by note title, for pickers such as a feed's manual entries. */
export async function listEvents(
  input: { search?: string; limit?: number } = {},
): Promise<EventListItem[]> {
  const now = new Date();
  const rows = await prisma.event.findMany({
    where: input.search
      ? { doc: { title: { contains: input.search, mode: "insensitive" } } }
      : {},
    select: {
      id: true,
      docId: true,
      decision: true,
      doc: { select: { title: true, collectionId: true } },
      occurrences: {
        where: { startsAt: { gte: now } },
        orderBy: { startsAt: "asc" },
        take: 1,
        select: { startsAt: true },
      },
      _count: { select: { occurrences: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: input.limit ?? 50,
  });
  return rows.map((r) => ({
    id: r.id,
    docId: r.docId,
    title: r.doc.title,
    collectionId: r.doc.collectionId,
    decision: r.decision,
    nextStartsAt: r.occurrences[0]?.startsAt.toISOString() ?? null,
    occurrenceCount: r._count.occurrences,
  }));
}
