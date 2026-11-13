// Nested profile records: contact methods, affiliations, and linked notes.
// Each write names the exact record it changes. Every function takes an
// optional transaction client so a multi-part profile update stays atomic.
import type { Prisma, PrismaClient } from "@prisma/client";
import { contactMatchValue } from "~/lib/people/contacts";
import {
  contactInputSchema,
  contactPatchSchema,
  type ContactInput,
  type ContactPatch,
} from "~/lib/people/schemas";
import type { ContactKind } from "~/lib/people/contacts";
import type {
  Affiliation,
  Colleague,
  Contact,
  LinkedNote,
} from "~/lib/people/types";
import { prisma } from "~/server/db";
import {
  AFFILIATION_INCLUDE,
  findColleagues,
  sortAffiliations,
  toAffiliation,
} from "./affiliation-store";
import { PeopleInputError } from "./errors";

export {
  addAffiliation,
  currentRoles,
  removeAffiliation,
  updateAffiliation,
} from "./affiliation-store";

export type Db = PrismaClient | Prisma.TransactionClient;

const blankToNull = (v: string | null | undefined) =>
  v === undefined ? undefined : v?.trim() || null;
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
  colleagues: Colleague[];
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
  const roles = sortAffiliations(affiliations.map(toAffiliation));
  return {
    contacts: contacts.map(toContact),
    affiliations: roles,
    colleagues: await findColleagues(roles, personId),
    notes: links.map((l) => l.doc),
  };
}
