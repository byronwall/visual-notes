// Nested profile records: contact methods, affiliations, and linked notes.
// Each write names the exact record it changes. Every function takes an
// optional transaction client so a multi-part profile update stays atomic.
import type { Prisma, PrismaClient } from "@prisma/client";
import { contactMatchValue } from "~/lib/people/contacts";
import { dayToDb, dbToDayOrNull, todayLocal } from "~/lib/people/dates";
import {
  affiliationInputSchema,
  affiliationPatchSchema,
  contactInputSchema,
  contactPatchSchema,
  type AffiliationInput,
  type AffiliationPatch,
  type ContactInput,
  type ContactPatch,
} from "~/lib/people/schemas";
import type { ContactKind } from "~/lib/people/contacts";
import type { Affiliation, Contact, LinkedNote } from "~/lib/people/types";
import { prisma } from "~/server/db";
import { PeopleInputError } from "./errors";

export type Db = PrismaClient | Prisma.TransactionClient;

const blankToNull = (v: string | null | undefined) =>
  v === undefined ? undefined : v?.trim() || null;
const dayOrNull = (v: string | null | undefined) =>
  v === undefined ? undefined : v ? dayToDb(v) : null;

const AFFILIATION_INCLUDE = {
  organization: { select: { id: true, name: true, kind: true } },
} satisfies Prisma.PersonAffiliationInclude;

type AffiliationRow = Prisma.PersonAffiliationGetPayload<{
  include: typeof AFFILIATION_INCLUDE;
}>;

export const toContact = (c: {
  id: string;
  kind: string;
  label: string | null;
  value: string;
}): Contact => ({
  id: c.id,
  kind: c.kind as ContactKind,
  label: c.label,
  value: c.value,
});

export const toAffiliation = (a: AffiliationRow): Affiliation => ({
  id: a.id,
  organization: a.organization,
  role: a.role,
  startOn: dbToDayOrNull(a.startOn),
  endOn: dbToDayOrNull(a.endOn),
});

/** Current roles first (newest start first), then past ones by end day. */
export const sortAffiliations = (list: Affiliation[]) =>
  [...list].sort((a, b) => {
    const aPast = a.endOn != null && a.endOn < todayLocal();
    const bPast = b.endOn != null && b.endOn < todayLocal();
    if (aPast !== bPast) return aPast ? 1 : -1;
    return (b.endOn ?? b.startOn ?? "").localeCompare(
      a.endOn ?? a.startOn ?? "",
    );
  });

export const isCurrent = (a: { endOn: string | null }) =>
  a.endOn == null || a.endOn >= todayLocal();

export const roleLabel = (a: Affiliation) =>
  a.role ? `${a.role}, ${a.organization.name}` : a.organization.name;

function checkDates(startOn?: string | null, endOn?: string | null) {
  if (startOn && endOn && endOn < startOn) {
    throw new PeopleInputError("An affiliation cannot end before it starts");
  }
}

// ------------------------------------------------------------- contacts

export async function addContact(
  personId: string,
  input: ContactInput,
  db: Db = prisma,
): Promise<Contact> {
  const parsed = contactInputSchema.parse(input);
  const row = await db.personContact.create({
    data: {
      personId,
      kind: parsed.kind,
      label: blankToNull(parsed.label),
      value: parsed.value.trim(),
      matchValue: contactMatchValue(parsed.kind, parsed.value),
    },
  });
  return toContact(row);
}

export async function updateContact(
  id: string,
  patch: ContactPatch,
  db: Db = prisma,
  personId?: string,
): Promise<Contact> {
  const parsed = contactPatchSchema.parse(patch);
  const current = await db.personContact.findUnique({ where: { id } });
  if (!current || (personId && current.personId !== personId)) {
    throw new PeopleInputError(`Contact not found: ${id}`, "not_found");
  }
  const kind = parsed.kind ?? (current.kind as ContactKind);
  const value = parsed.value?.trim() ?? current.value;
  const row = await db.personContact.update({
    where: { id },
    data: {
      kind,
      value,
      label: blankToNull(parsed.label),
      matchValue: contactMatchValue(kind, value),
    },
  });
  return toContact(row);
}

export async function removeContact(
  id: string,
  db: Db = prisma,
  personId?: string,
) {
  const { count } = await db.personContact.deleteMany({
    where: { id, ...(personId ? { personId } : {}) },
  });
  if (!count)
    throw new PeopleInputError(`Contact not found: ${id}`, "not_found");
}

// ---------------------------------------------------------- affiliations

export async function addAffiliation(
  personId: string,
  input: AffiliationInput,
  db: Db = prisma,
): Promise<Affiliation> {
  const parsed = affiliationInputSchema.parse(input);
  checkDates(parsed.startOn, parsed.endOn);
  const org = await db.organization.findUnique({
    where: { id: parsed.organizationId },
    select: { id: true },
  });
  if (!org) {
    throw new PeopleInputError(
      `Organization not found: ${parsed.organizationId}`,
      "not_found",
    );
  }
  const row = await db.personAffiliation.create({
    data: {
      personId,
      organizationId: parsed.organizationId,
      role: blankToNull(parsed.role),
      startOn: dayOrNull(parsed.startOn),
      endOn: dayOrNull(parsed.endOn),
    },
    include: AFFILIATION_INCLUDE,
  });
  return toAffiliation(row);
}

/** Changes a role or its dates. Recording an end day keeps the history. */
export async function updateAffiliation(
  id: string,
  patch: AffiliationPatch,
  db: Db = prisma,
  personId?: string,
): Promise<Affiliation> {
  const parsed = affiliationPatchSchema.parse(patch);
  const current = await db.personAffiliation.findUnique({ where: { id } });
  if (!current || (personId && current.personId !== personId)) {
    throw new PeopleInputError(`Affiliation not found: ${id}`, "not_found");
  }
  checkDates(
    parsed.startOn === undefined
      ? dbToDayOrNull(current.startOn)
      : parsed.startOn,
    parsed.endOn === undefined ? dbToDayOrNull(current.endOn) : parsed.endOn,
  );
  const row = await db.personAffiliation.update({
    where: { id },
    data: {
      role: blankToNull(parsed.role),
      startOn: dayOrNull(parsed.startOn),
      endOn: dayOrNull(parsed.endOn),
    },
    include: AFFILIATION_INCLUDE,
  });
  return toAffiliation(row);
}

/** Removes a wrong association. To record that a role ended, set endOn instead. */
export async function removeAffiliation(
  id: string,
  db: Db = prisma,
  personId?: string,
) {
  const { count } = await db.personAffiliation.deleteMany({
    where: { id, ...(personId ? { personId } : {}) },
  });
  if (!count) {
    throw new PeopleInputError(`Affiliation not found: ${id}`, "not_found");
  }
}

// ---------------------------------------------------------- linked notes

export async function linkNote(
  personId: string,
  docId: string,
  db: Db = prisma,
) {
  const doc = await db.doc.findUnique({
    where: { id: docId },
    select: { id: true },
  });
  if (!doc) throw new PeopleInputError(`Note not found: ${docId}`, "not_found");
  await db.personDocLink.upsert({
    where: { personId_docId: { personId, docId } },
    create: { personId, docId },
    update: {},
  });
}

export async function unlinkNote(
  personId: string,
  docId: string,
  db: Db = prisma,
) {
  await db.personDocLink.deleteMany({ where: { personId, docId } });
}

// ----------------------------------------------------------------- reads

export async function readProfileParts(personId: string): Promise<{
  contacts: Contact[];
  affiliations: Affiliation[];
  notes: LinkedNote[];
}> {
  const [contacts, affiliations, links] = await Promise.all([
    prisma.personContact.findMany({
      where: { personId },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    }),
    prisma.personAffiliation.findMany({
      where: { personId },
      include: AFFILIATION_INCLUDE,
    }),
    prisma.personDocLink.findMany({
      where: { personId },
      include: { doc: { select: { id: true, title: true, path: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    contacts: contacts.map(toContact),
    affiliations: sortAffiliations(affiliations.map(toAffiliation)),
    notes: links.map((l) => l.doc),
  };
}

/** "Role, Organization" for each person's newest current affiliation. */
export async function currentRoles(
  personIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!personIds.length) return out;
  const rows = await prisma.personAffiliation.findMany({
    where: {
      personId: { in: personIds },
      organization: { archivedAt: null },
      OR: [{ endOn: null }, { endOn: { gte: dayToDb(todayLocal()) } }],
    },
    include: AFFILIATION_INCLUDE,
    orderBy: [
      { startOn: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });
  for (const row of rows) {
    if (!out.has(row.personId))
      out.set(row.personId, roleLabel(toAffiliation(row)));
  }
  return out;
}
