// People persistence: profiles, directory listing, and search. Facts and
// encounters live in memory-store.ts. UI server functions and MCP tools both
// call these functions, so validation happens here.
import type { Prisma } from "@prisma/client";
import {
  peopleListSchema,
  personInputSchema,
  personPatchSchema,
  type PeopleListInput,
  type PersonInput,
  type PersonPatch,
} from "~/lib/people/schemas";
import type {
  PersonMatch,
  PersonProfile,
  PersonSummary,
} from "~/lib/people/types";
import { prisma } from "~/server/db";
import { PeopleInputError, withRequestKey } from "./errors";
import { listPersonFacts, listPersonInteractions } from "./memory-store";
import { lastContactByPerson } from "./recency";

type PersonRow = Prisma.PersonGetPayload<object>;

const blankToNull = (v: string | null | undefined) =>
  v === undefined ? undefined : v?.trim() || null;

const uniqueTags = (values: string[] | undefined) =>
  values === undefined
    ? undefined
    : [...new Map(values.map((v) => [v.toLowerCase(), v.trim()])).values()];

export const customFieldsOf = (value: Prisma.JsonValue) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (Object.fromEntries(
        Object.entries(value).filter(([, v]) => typeof v === "string"),
      ) as Record<string, string>)
    : {};

export const toPersonSummary = (
  p: PersonRow,
  lastContactOn: string | null,
): PersonSummary => ({
  id: p.id,
  displayName: p.displayName,
  aliases: p.aliases,
  summary: p.summary,
  location: p.location,
  contexts: p.contexts,
  lastContactOn,
  archivedAt: p.archivedAt?.toISOString() ?? null,
});

export async function requirePerson(id: string): Promise<PersonRow> {
  const row = await prisma.person.findUnique({ where: { id } });
  if (!row) throw new PeopleInputError(`Person not found: ${id}`, "not_found");
  return row;
}

export async function createPerson(
  input: PersonInput,
): Promise<{ person: PersonSummary; existing: boolean }> {
  const parsed = personInputSchema.parse(input);
  const { record, existing } = await withRequestKey(
    parsed.requestKey,
    (requestKey) => prisma.person.findUnique({ where: { requestKey } }),
    () =>
      prisma.person.create({
        data: {
          displayName: parsed.displayName,
          aliases: uniqueTags(parsed.aliases) ?? [],
          summary: blankToNull(parsed.summary),
          location: blankToNull(parsed.location),
          howKnown: blankToNull(parsed.howKnown),
          contexts: uniqueTags(parsed.contexts) ?? [],
          customFields: parsed.customFields ?? {},
          requestKey: parsed.requestKey,
        },
      }),
  );
  console.info(`[people] ${existing ? "reused" : "created"} person`, record.id);
  const last = existing ? await lastContactByPerson([record.id]) : new Map();
  return {
    person: toPersonSummary(record, last.get(record.id) ?? null),
    existing,
  };
}

/** Patches only the fields present; null or "" clears an optional field. */
export async function updatePerson(
  id: string,
  patch: PersonPatch,
): Promise<{ person: PersonSummary; changed: string[] }> {
  const parsed = personPatchSchema.parse(patch);
  const current = await requirePerson(id);
  const data: Prisma.PersonUpdateInput = {
    displayName: parsed.displayName,
    aliases: uniqueTags(parsed.aliases),
    summary: blankToNull(parsed.summary),
    location: blankToNull(parsed.location),
    howKnown: blankToNull(parsed.howKnown),
    contexts: uniqueTags(parsed.contexts),
    customFields: parsed.customFields,
  };
  if (parsed.archived !== undefined) {
    data.archivedAt = parsed.archived ? current.archivedAt ?? new Date() : null;
  }
  const changed = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => (k === "archivedAt" ? "archived" : k));
  const row = await prisma.person.update({ where: { id }, data });
  console.info(`[people] updated person`, id, changed.join(","));
  const last = await lastContactByPerson([id]);
  return { person: toPersonSummary(row, last.get(id) ?? null), changed };
}

export async function getPersonProfile(
  id: string,
  opts: { interactionLimit?: number } = {},
): Promise<PersonProfile | null> {
  const row = await prisma.person.findUnique({ where: { id } });
  if (!row) return null;
  const [last, facts, history] = await Promise.all([
    lastContactByPerson([id]),
    listPersonFacts(id),
    listPersonInteractions(id, { limit: opts.interactionLimit ?? 100 }),
  ]);
  return {
    ...toPersonSummary(row, last.get(id) ?? null),
    howKnown: row.howKnown,
    customFields: customFieldsOf(row.customFields),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    facts,
    interactions: history.interactions,
  };
}

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });

/**
 * Person ids matching `q`, with the text that matched. Name and alias hits
 * come first; then profile text, remembered facts, and encounter summaries.
 */
async function searchPersonIds(q: string): Promise<Map<string, string | null>> {
  const hits = new Map<string, string | null>();
  const add = (id: string, matched: string | null) => {
    if (!hits.has(id)) hits.set(id, matched);
  };
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const [names, aliases, profile, facts, encounters] = await Promise.all([
    prisma.person.findMany({
      where: { displayName: contains(q) },
      select: { id: true },
      take: 1000,
    }),
    prisma.$queryRaw<{ id: string; alias: string }[]>`
      SELECT p.id, a AS alias FROM "Person" p, unnest(p.aliases) a
      WHERE a ILIKE ${like} LIMIT 1000`,
    prisma.person.findMany({
      where: {
        OR: [
          { summary: contains(q) },
          { location: contains(q) },
          { howKnown: contains(q) },
        ],
      },
      select: { id: true, summary: true, location: true, howKnown: true },
      take: 1000,
    }),
    prisma.personFact.findMany({
      where: { text: contains(q) },
      select: { personId: true, text: true, retiredAt: true },
      orderBy: { retiredAt: { sort: "desc", nulls: "first" } },
      take: 1000,
    }),
    prisma.interactionParticipant.findMany({
      where: { interaction: { summary: contains(q), archivedAt: null } },
      select: { personId: true, interaction: { select: { summary: true } } },
      take: 1000,
    }),
  ]);
  for (const p of names) add(p.id, null);
  for (const a of aliases) add(a.id, `Also known as ${a.alias}`);
  const lower = q.toLowerCase();
  for (const p of profile) {
    const field = [p.summary, p.location, p.howKnown].find((v) =>
      v?.toLowerCase().includes(lower),
    );
    add(p.id, field ?? null);
  }
  for (const f of facts) add(f.personId, f.text);
  for (const e of encounters) add(e.personId, e.interaction.summary);
  return hits;
}

/** The directory: filtered, searched, and paged. Archived people are hidden unless asked for. */
export async function listPeople(input: PeopleListInput = {}): Promise<{
  people: PersonMatch[];
  total: number;
  hasMore: boolean;
}> {
  const {
    search,
    context,
    archived,
    limit = 50,
    offset = 0,
  } = peopleListSchema.parse(input);
  const q = search?.trim();
  const where: Prisma.PersonWhereInput = {
    archivedAt: archived ? { not: null } : null,
    ...(context ? { contexts: { has: context } } : {}),
  };
  let ordered: { row: PersonRow; matchedIn: string | null }[];
  let total: number;
  if (q) {
    const hits = await searchPersonIds(q);
    const rows = await prisma.person.findMany({
      where: { ...where, id: { in: [...hits.keys()] } },
    });
    const rank = (r: PersonRow) => (hits.get(r.id) == null ? 0 : 1);
    rows.sort(
      (a, b) => rank(a) - rank(b) || a.displayName.localeCompare(b.displayName),
    );
    total = rows.length;
    ordered = rows
      .slice(offset, offset + limit)
      .map((row) => ({ row, matchedIn: hits.get(row.id) ?? null }));
  } else {
    const [rows, count] = await Promise.all([
      prisma.person.findMany({
        where,
        orderBy: [{ displayName: "asc" }, { id: "asc" }],
        skip: offset,
        take: limit,
      }),
      prisma.person.count({ where }),
    ]);
    total = count;
    ordered = rows.map((row) => ({ row, matchedIn: null }));
  }
  const last = await lastContactByPerson(ordered.map((o) => o.row.id));
  return {
    people: ordered.map(({ row, matchedIn }) => ({
      ...toPersonSummary(row, last.get(row.id) ?? null),
      matchedIn,
    })),
    total,
    hasMore: offset + ordered.length < total,
  };
}

/** Every context in use, most common first, for filters and suggestions. */
export async function listPeopleContexts(): Promise<
  { context: string; count: number }[]
> {
  const rows = await prisma.$queryRaw<{ context: string; count: bigint }[]>`
    SELECT c AS context, count(*) AS count
    FROM "Person" p, unnest(p.contexts) c
    WHERE p."archivedAt" IS NULL
    GROUP BY c ORDER BY count(*) DESC, c ASC LIMIT 100`;
  return rows.map((r) => ({ context: r.context, count: Number(r.count) }));
}

/** Possible matches for a typed name, for capture and agent lookups. */
export async function findPeopleByName(
  name: string,
  limit = 8,
): Promise<PersonSummary[]> {
  const q = name.trim();
  if (!q) return [];
  const { people } = await listPeople({ search: q, limit });
  return people.filter(
    (p) => p.matchedIn == null || p.matchedIn.startsWith("Also known as"),
  );
}
