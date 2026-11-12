// People persistence: profiles, directory listing, and search. Facts and
// encounters live in memory-store.ts. UI server functions and MCP tools both
// call these functions, so validation happens here.
import type { Prisma } from "@prisma/client";
import {
  peopleListSchema,
  personInputSchema,
  personPatchSchema,
  personUpdateSchema,
  type PersonUpdate,
  type PeopleListInput,
  type AffiliationInput,
  type ContactInput,
  type PersonInput,
  type PersonPatch,
} from "~/lib/people/schemas";
import type {
  PersonMatch,
  PersonProfile,
  PersonSummary,
} from "~/lib/people/types";
import { prisma } from "~/server/db";
import { addDays, todayLocal } from "~/lib/people/dates";
import { PeopleInputError, withRequestKey } from "./errors";
import { listPersonFacts, listPersonInteractions } from "./memory-store";
import {
  addAffiliation,
  addContact,
  currentRoles,
  linkNote,
  readProfileParts,
  removeAffiliation,
  removeContact,
  unlinkNote,
  updateAffiliation,
  updateContact,
  type Db,
} from "./profile-store";
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
  currentRole: string | null = null,
): PersonSummary => ({
  id: p.id,
  displayName: p.displayName,
  aliases: p.aliases,
  summary: p.summary,
  location: p.location,
  contexts: p.contexts,
  lastContactOn,
  currentRole,
  archivedAt: p.archivedAt?.toISOString() ?? null,
});

/** Summaries with last contact and current role filled in. */
export async function summarize(rows: PersonRow[]): Promise<PersonSummary[]> {
  const ids = rows.map((r) => r.id);
  const [last, roles] = await Promise.all([
    lastContactByPerson(ids),
    currentRoles(ids),
  ]);
  return rows.map((r) =>
    toPersonSummary(r, last.get(r.id) ?? null, roles.get(r.id) ?? null),
  );
}

export async function requirePerson(
  id: string,
  db: Db = prisma,
): Promise<PersonRow> {
  const row = await db.person.findUnique({ where: { id } });
  if (!row) throw new PeopleInputError(`Person not found: ${id}`, "not_found");
  return row;
}

/**
 * Creates a person, and any contacts, roles, and note links with it, in one
 * transaction: a bad nested record leaves no half-made person behind.
 */
export async function createPerson(
  input: PersonInput,
  parts: {
    contacts?: ContactInput[];
    affiliations?: AffiliationInput[];
    noteIds?: string[];
  } = {},
): Promise<{ person: PersonSummary; existing: boolean }> {
  const parsed = personInputSchema.parse(input);
  const { record, existing } = await withRequestKey(
    parsed.requestKey,
    (requestKey) => prisma.person.findUnique({ where: { requestKey } }),
    () =>
      prisma.$transaction(async (tx) => {
        const row = await tx.person.create({
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
        });
        for (const c of parts.contacts ?? []) await addContact(row.id, c, tx);
        for (const a of parts.affiliations ?? []) {
          await addAffiliation(row.id, a, tx);
        }
        for (const docId of parts.noteIds ?? [])
          await linkNote(row.id, docId, tx);
        return row;
      }),
  );
  console.info(`[people] ${existing ? "reused" : "created"} person`, record.id);
  const [person] = await summarize([record]);
  return { person, existing };
}

/** Patches only the fields present; null or "" clears an optional field. */
export async function updatePerson(
  id: string,
  patch: PersonPatch,
): Promise<{ person: PersonSummary; changed: string[] }> {
  const parsed = personPatchSchema.parse(patch);
  const { row, changed } = await patchPersonRow(prisma, id, parsed);
  console.info(`[people] updated person`, id, changed.join(","));
  const [person] = await summarize([row]);
  return { person, changed };
}

/**
 * The agent's profile update: identity fields, custom-field merges, and
 * exact nested contact, role, and note-link changes, all or nothing.
 */
export async function updatePersonProfile(
  id: string,
  input: PersonUpdate,
): Promise<{ person: PersonSummary; changed: string[] }> {
  const parsed = personUpdateSchema.parse(input);
  const {
    setCustomFields,
    removeCustomFields,
    contacts,
    affiliations,
    notes,
    ...patch
  } = parsed;
  const changed: string[] = [];
  const row = await prisma.$transaction(async (tx) => {
    const current = await requirePerson(id, tx);
    if (setCustomFields || removeCustomFields) {
      const fields = {
        ...customFieldsOf(current.customFields),
        ...(patch.customFields ?? {}),
        ...setCustomFields,
      };
      for (const key of removeCustomFields ?? []) delete fields[key];
      patch.customFields = fields;
    }
    for (const c of contacts?.add ?? []) await addContact(id, c, tx);
    for (const { id: cid, ...c } of contacts?.update ?? [])
      await updateContact(cid, c, tx, id);
    for (const cid of contacts?.remove ?? []) await removeContact(cid, tx, id);
    if (contacts) changed.push("contacts");
    for (const a of affiliations?.add ?? []) await addAffiliation(id, a, tx);
    for (const { id: aid, ...a } of affiliations?.update ?? [])
      await updateAffiliation(aid, a, tx, id);
    for (const aid of affiliations?.remove ?? [])
      await removeAffiliation(aid, tx, id);
    if (affiliations) changed.push("affiliations");
    for (const docId of notes?.link ?? []) await linkNote(id, docId, tx);
    for (const docId of notes?.unlink ?? []) await unlinkNote(id, docId, tx);
    if (notes) changed.push("notes");
    const result = await patchPersonRow(tx, id, patch);
    changed.unshift(...result.changed.filter((k) => k !== "updatedAt"));
    return result.row;
  });
  console.info(`[people] updated profile`, id, changed.join(","));
  const [person] = await summarize([row]);
  return { person, changed };
}

async function patchPersonRow(db: Db, id: string, parsed: PersonPatch) {
  const current = await requirePerson(id, db);
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
  // Touch updatedAt even when only nested records changed.
  const row = await db.person.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
  });
  return { row, changed };
}

export async function getPersonProfile(
  id: string,
  opts: { interactionLimit?: number } = {},
): Promise<PersonProfile | null> {
  const row = await prisma.person.findUnique({ where: { id } });
  if (!row) return null;
  const [[summary], facts, history, parts] = await Promise.all([
    summarize([row]),
    listPersonFacts(id),
    listPersonInteractions(id, { limit: opts.interactionLimit ?? 100 }),
    readProfileParts(id),
  ]);
  const mergedInto = row.mergedIntoId
    ? await prisma.person.findUnique({
        where: { id: row.mergedIntoId },
        select: { id: true, displayName: true },
      })
    : null;
  return {
    ...summary,
    ...parts,
    mergedInto,
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
  const digits = q.replace(/\D/g, "");

  const [names, aliases, profile, facts, encounters, contacts, orgs] =
    await Promise.all([
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
      prisma.personContact.findMany({
        where: {
          OR: [
            { value: contains(q) },
            // Phone numbers match by digits, however they were typed.
            ...(digits.length >= 4
              ? [{ kind: "phone" as const, matchValue: { contains: digits } }]
              : []),
          ],
        },
        select: { personId: true, value: true },
        take: 1000,
      }),
      prisma.personAffiliation.findMany({
        where: { organization: { name: contains(q) } },
        select: {
          personId: true,
          role: true,
          organization: { select: { name: true } },
        },
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
  for (const c of contacts) add(c.personId, c.value);
  for (const a of orgs) {
    add(
      a.personId,
      a.role ? `${a.role}, ${a.organization.name}` : a.organization.name,
    );
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
    organizationId,
    contact,
    archived,
    limit = 50,
    offset = 0,
  } = peopleListSchema.parse(input);
  const q = search?.trim();
  const where: Prisma.PersonWhereInput = {
    archivedAt: archived ? { not: null } : null,
    ...(context ? { contexts: { has: context } } : {}),
    ...(organizationId ? { affiliations: { some: { organizationId } } } : {}),
    ...(contact ? { id: await contactWindowFilter(contact) } : {}),
  };
  let ordered: { row: PersonRow; matchedIn: string | null }[];
  let total: number;
  if (q) {
    const hits = await searchPersonIds(q);
    const rows = await prisma.person.findMany({
      where: { AND: [where, { id: { in: [...hits.keys()] } }] },
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
  const summaries = await summarize(ordered.map((o) => o.row));
  return {
    people: summaries.map((summary, i) => ({
      ...summary,
      matchedIn: ordered[i].matchedIn,
    })),
    total,
    hasMore: offset + ordered.length < total,
  };
}

/** The person-id condition for a last-contact window. */
async function contactWindowFilter(
  window: NonNullable<PeopleListInput["contact"]>,
): Promise<Prisma.StringFilter> {
  const last = await lastContactByPerson();
  if (window === "none") return { notIn: [...last.keys()] };
  const today = todayLocal();
  const ids = [...last]
    .filter(([, day]) =>
      window === "over365"
        ? day < addDays(today, -365)
        : day >= addDays(today, -Number(window)),
    )
    .map(([id]) => id);
  return { in: ids };
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
