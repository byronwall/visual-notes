// Remembered facts and shared encounters. A fact belongs to one person and
// never changes contact recency. An encounter is one record shared by all of
// its participants; only participants with countsAsContact advance recency.
import type { Prisma } from "@prisma/client";
import {
  dayToDb,
  dbToDay,
  dbToDayOrNull,
  todayLocal,
} from "~/lib/people/dates";
import {
  factInputSchema,
  factPatchSchema,
  interactionInputSchema,
  interactionPatchSchema,
  type FactInput,
  type FactPatch,
  type InteractionInput,
  type InteractionPatch,
} from "~/lib/people/schemas";
import type {
  Fact,
  InteractionKind,
  InteractionView,
} from "~/lib/people/types";
import { prisma } from "~/server/db";
import { PeopleInputError, withRequestKey } from "./errors";

type FactRow = Prisma.PersonFactGetPayload<object>;

const INTERACTION_INCLUDE = {
  participants: {
    include: { person: { select: { id: true, displayName: true } } },
  },
} satisfies Prisma.InteractionInclude;
type InteractionRow = Prisma.InteractionGetPayload<{
  include: typeof INTERACTION_INCLUDE;
}>;

const blankToNull = (v: string | null | undefined) =>
  v === undefined ? undefined : v?.trim() || null;

export const toFact = (f: FactRow): Fact => ({
  id: f.id,
  personId: f.personId,
  text: f.text,
  category: f.category,
  learnedOn: dbToDayOrNull(f.learnedOn),
  sourceLabel: f.sourceLabel,
  sourceUrl: f.sourceUrl,
  sourceDocId: f.sourceDocId,
  retiredAt: f.retiredAt?.toISOString() ?? null,
  createdAt: f.createdAt.toISOString(),
});

export const toInteraction = (i: InteractionRow): InteractionView => ({
  id: i.id,
  occurredOn: dbToDay(i.occurredOn),
  kind: i.kind as InteractionKind,
  summary: i.summary,
  sourceLabel: i.sourceLabel,
  sourceUrl: i.sourceUrl,
  sourceDocId: i.sourceDocId,
  archivedAt: i.archivedAt?.toISOString() ?? null,
  participants: i.participants
    .map((p) => ({
      id: p.person.id,
      displayName: p.person.displayName,
      countsAsContact: p.countsAsContact,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName)),
  createdAt: i.createdAt.toISOString(),
});

/** Refuses a day after today; unknown history stays unknown, not "today". */
function notFuture(day: string | null | undefined, what: string) {
  if (day && day > todayLocal()) {
    throw new PeopleInputError(`${what} cannot be in the future (${day})`);
  }
}

async function requireDoc(id: string | null | undefined) {
  if (!id) return;
  const doc = await prisma.doc.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!doc) throw new PeopleInputError(`Note not found: ${id}`, "not_found");
}

async function requirePeople(ids: string[]) {
  const found = await prisma.person.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const known = new Set(found.map((p) => p.id));
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length) {
    throw new PeopleInputError(
      `Person not found: ${missing.join(", ")}`,
      "not_found",
    );
  }
}

const source = (input: {
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  sourceDocId?: string | null;
}) => ({
  sourceLabel: blankToNull(input.sourceLabel),
  sourceUrl: blankToNull(input.sourceUrl),
  sourceDocId:
    input.sourceDocId === undefined ? undefined : input.sourceDocId || null,
});

// ---------------------------------------------------------------- facts

/** Current facts first (newest learned first), then retired ones. */
export async function listPersonFacts(personId: string): Promise<Fact[]> {
  const rows = await prisma.personFact.findMany({
    where: { personId },
    orderBy: [
      { retiredAt: { sort: "desc", nulls: "first" } },
      { learnedOn: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });
  return rows.map(toFact);
}

export async function addFact(
  input: FactInput,
): Promise<{ fact: Fact; existing: boolean }> {
  const parsed = factInputSchema.parse(input);
  notFuture(parsed.learnedOn, "Learned date");
  const { record, existing } = await withRequestKey(
    parsed.requestKey,
    (requestKey) => prisma.personFact.findUnique({ where: { requestKey } }),
    async () => {
      await requirePeople([parsed.personId]);
      await requireDoc(parsed.sourceDocId);
      return prisma.personFact.create({
        data: {
          personId: parsed.personId,
          text: parsed.text,
          category: blankToNull(parsed.category),
          learnedOn: parsed.learnedOn ? dayToDb(parsed.learnedOn) : null,
          ...source(parsed),
          requestKey: parsed.requestKey,
        },
      });
    },
  );
  console.info(`[people] ${existing ? "reused" : "added"} fact`, record.id);
  return { fact: toFact(record), existing };
}

/** Corrects or retires one fact; other facts and the profile stay as they are. */
export async function updateFact(id: string, patch: FactPatch): Promise<Fact> {
  const parsed = factPatchSchema.parse(patch);
  notFuture(parsed.learnedOn, "Learned date");
  await requireDoc(parsed.sourceDocId);
  const current = await prisma.personFact.findUnique({ where: { id } });
  if (!current)
    throw new PeopleInputError(`Fact not found: ${id}`, "not_found");
  const row = await prisma.personFact.update({
    where: { id },
    data: {
      text: parsed.text,
      category: blankToNull(parsed.category),
      learnedOn:
        parsed.learnedOn === undefined
          ? undefined
          : parsed.learnedOn
            ? dayToDb(parsed.learnedOn)
            : null,
      ...source(parsed),
      retiredAt:
        parsed.retired === undefined
          ? undefined
          : parsed.retired
            ? current.retiredAt ?? new Date()
            : null,
    },
  });
  console.info(`[people] updated fact`, id);
  return toFact(row);
}

// ---------------------------------------------------------- interactions

/** One participant per person; a repeated id keeps its first entry. */
function participantRows(
  participants: { personId: string; countsAsContact?: boolean }[],
) {
  const seen = new Map<string, boolean>();
  for (const p of participants) {
    if (!seen.has(p.personId)) seen.set(p.personId, p.countsAsContact ?? true);
  }
  return [...seen].map(([personId, countsAsContact]) => ({
    personId,
    countsAsContact,
  }));
}

export async function getInteraction(
  id: string,
): Promise<InteractionView | null> {
  const row = await prisma.interaction.findUnique({
    where: { id },
    include: INTERACTION_INCLUDE,
  });
  return row ? toInteraction(row) : null;
}

/** Newest first; archived encounters only when asked for. */
export async function listPersonInteractions(
  personId: string,
  opts: { limit?: number; offset?: number; includeArchived?: boolean } = {},
): Promise<{ interactions: InteractionView[]; hasMore: boolean }> {
  const limit = opts.limit ?? 50;
  const rows = await prisma.interaction.findMany({
    where: {
      participants: { some: { personId } },
      ...(opts.includeArchived ? {} : { archivedAt: null }),
    },
    include: INTERACTION_INCLUDE,
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    skip: opts.offset ?? 0,
    take: limit + 1,
  });
  return {
    interactions: rows.slice(0, limit).map(toInteraction),
    hasMore: rows.length > limit,
  };
}

export async function logInteraction(
  input: InteractionInput,
): Promise<{ interaction: InteractionView; existing: boolean }> {
  const parsed = interactionInputSchema.parse(input);
  notFuture(parsed.occurredOn, "Encounter day");
  const participants = participantRows(parsed.participants);
  const { record, existing } = await withRequestKey(
    parsed.requestKey,
    (requestKey) =>
      prisma.interaction.findUnique({
        where: { requestKey },
        include: INTERACTION_INCLUDE,
      }),
    async () => {
      await requirePeople(participants.map((p) => p.personId));
      await requireDoc(parsed.sourceDocId);
      return prisma.interaction.create({
        data: {
          occurredOn: dayToDb(parsed.occurredOn),
          kind: parsed.kind ?? "in_person",
          summary: parsed.summary,
          ...source(parsed),
          requestKey: parsed.requestKey,
          participants: { create: participants },
        },
        include: INTERACTION_INCLUDE,
      });
    },
  );
  console.info(
    `[people] ${existing ? "reused" : "logged"} interaction`,
    record.id,
    `${participants.length} participants`,
  );
  return { interaction: toInteraction(record), existing };
}

/** Corrects one encounter; a participant list replaces the whole set. */
export async function updateInteraction(
  id: string,
  patch: InteractionPatch,
): Promise<InteractionView> {
  const parsed = interactionPatchSchema.parse(patch);
  notFuture(parsed.occurredOn, "Encounter day");
  await requireDoc(parsed.sourceDocId);
  const current = await prisma.interaction.findUnique({ where: { id } });
  if (!current) {
    throw new PeopleInputError(`Interaction not found: ${id}`, "not_found");
  }
  const participants = parsed.participants
    ? participantRows(parsed.participants)
    : null;
  if (participants) await requirePeople(participants.map((p) => p.personId));
  const row = await prisma.$transaction(async (tx) => {
    if (participants) {
      await tx.interactionParticipant.deleteMany({
        where: { interactionId: id },
      });
      await tx.interactionParticipant.createMany({
        data: participants.map((p) => ({ ...p, interactionId: id })),
      });
    }
    return tx.interaction.update({
      where: { id },
      data: {
        occurredOn: parsed.occurredOn ? dayToDb(parsed.occurredOn) : undefined,
        kind: parsed.kind,
        summary: parsed.summary,
        ...source(parsed),
        archivedAt:
          parsed.archived === undefined
            ? undefined
            : parsed.archived
              ? current.archivedAt ?? new Date()
              : null,
      },
      include: INTERACTION_INCLUDE,
    });
  });
  console.info(`[people] updated interaction`, id);
  return toInteraction(row);
}
