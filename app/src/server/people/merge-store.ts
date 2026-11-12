// Duplicate candidates and manual merge. Candidates come with evidence (same
// name, same email, ...) and are never merged automatically. A merge moves
// everything to the surviving profile in one transaction and archives the
// other one with a pointer to the survivor.
import { prisma } from "~/server/db";
import { PeopleInputError } from "./errors";

export type DuplicateCandidate = {
  id: string;
  displayName: string;
  evidence: string[];
};

/** People who might be the same as `personId`, with why. */
export async function findDuplicates(
  personId: string,
): Promise<DuplicateCandidate[]> {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    include: { contacts: true },
  });
  if (!person)
    throw new PeopleInputError(`Person not found: ${personId}`, "not_found");
  const contactOr = person.contacts.map((c) => ({
    kind: c.kind,
    matchValue: c.matchValue,
  }));
  const names = [person.displayName, ...person.aliases];
  const rows = await prisma.person.findMany({
    where: {
      id: { not: personId },
      archivedAt: null,
      OR: [
        ...names.map((n) => ({
          displayName: { equals: n, mode: "insensitive" as const },
        })),
        { aliases: { hasSome: names } },
        ...(contactOr.length
          ? [{ contacts: { some: { OR: contactOr } } }]
          : []),
      ],
    },
    include: { contacts: true },
    take: 20,
  });
  const lowerNames = new Set(names.map((n) => n.toLowerCase()));
  return rows.map((r) => {
    const evidence: string[] = [];
    if (lowerNames.has(r.displayName.toLowerCase())) evidence.push("same name");
    else if (r.aliases.some((a) => lowerNames.has(a.toLowerCase())))
      evidence.push("name matches an alias");
    for (const c of r.contacts) {
      if (
        contactOr.some(
          (o) => o.kind === c.kind && o.matchValue === c.matchValue,
        )
      ) {
        evidence.push(`same ${c.kind} ${c.value}`);
      }
    }
    return { id: r.id, displayName: r.displayName, evidence };
  });
}

/** Groups of active people who share a name or a contact value. */
export async function listDuplicateGroups(limit = 50) {
  const byName = await prisma.$queryRaw<{ key: string; ids: string[] }[]>`
    SELECT lower("displayName") AS key, array_agg(id ORDER BY "createdAt") AS ids
    FROM "Person" WHERE "archivedAt" IS NULL
    GROUP BY lower("displayName") HAVING count(*) > 1
    ORDER BY key LIMIT ${limit}`;
  const byContact = await prisma.$queryRaw<{ key: string; ids: string[] }[]>`
    SELECT c.kind || ' ' || c."matchValue" AS key, array_agg(DISTINCT c."personId") AS ids
    FROM "PersonContact" c JOIN "Person" p ON p.id = c."personId"
    WHERE p."archivedAt" IS NULL
    GROUP BY c.kind, c."matchValue" HAVING count(DISTINCT c."personId") > 1
    ORDER BY key LIMIT ${limit}`;
  const ids = [...new Set([...byName, ...byContact].flatMap((g) => g.ids))];
  const people = await prisma.person.findMany({
    where: { id: { in: ids } },
    select: { id: true, displayName: true, createdAt: true },
  });
  const ref = new Map(
    people.map((p) => [p.id, { id: p.id, displayName: p.displayName }]),
  );
  const group =
    (reason: (key: string) => string) =>
    (g: { key: string; ids: string[] }) => ({
      reason: reason(g.key),
      people: g.ids.map((id) => ref.get(id)!).filter(Boolean),
    });
  return [
    ...byName.map(group(() => "Same name")),
    ...byContact.map(group((key) => `Same ${key}`)),
  ];
}

export const MERGE_FIELDS = [
  "displayName",
  "summary",
  "location",
  "howKnown",
] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];

/**
 * Moves the duplicate's facts, contacts, roles, linked notes, encounters, and
 * import identities to the survivor, then archives the duplicate. `take`
 * lists profile fields to copy from the duplicate; other fields keep the
 * survivor's value, or the duplicate's when the survivor's is empty.
 */
export async function mergePeople(input: {
  survivorId: string;
  duplicateId: string;
  take?: MergeField[];
}) {
  const { survivorId, duplicateId } = input;
  if (survivorId === duplicateId)
    throw new PeopleInputError("Pick two different people");
  const take = new Set(input.take ?? []);
  const result = await prisma.$transaction(async (tx) => {
    const [a, b] = await Promise.all([
      tx.person.findUnique({
        where: { id: survivorId },
        include: { contacts: true, affiliations: true },
      }),
      tx.person.findUnique({
        where: { id: duplicateId },
        include: { contacts: true, affiliations: true },
      }),
    ]);
    if (!a || !b) throw new PeopleInputError("Person not found", "not_found");
    if (a.mergedIntoId || b.mergedIntoId) {
      throw new PeopleInputError("One of these people was already merged");
    }

    const pick = (f: MergeField) => (take.has(f) ? b[f] ?? a[f] : a[f] ?? b[f]);
    const displayName = pick("displayName") ?? a.displayName;
    const aliases = [
      ...new Map(
        [...a.aliases, ...b.aliases, a.displayName, b.displayName]
          .filter((n) => n.toLowerCase() !== displayName.toLowerCase())
          .map((n) => [n.toLowerCase(), n]),
      ).values(),
    ];
    const contexts = [
      ...new Map(
        [...a.contexts, ...b.contexts].map((c) => [c.toLowerCase(), c]),
      ).values(),
    ];
    const fields = {
      ...(b.customFields as Record<string, string>),
      ...(a.customFields as Record<string, string>),
    };

    const facts = await tx.personFact.updateMany({
      where: { personId: b.id },
      data: { personId: a.id },
    });

    let contacts = 0;
    for (const c of b.contacts) {
      const dup = a.contacts.some(
        (x) => x.kind === c.kind && x.matchValue === c.matchValue,
      );
      if (dup) await tx.personContact.delete({ where: { id: c.id } });
      else {
        await tx.personContact.update({
          where: { id: c.id },
          data: { personId: a.id },
        });
        contacts++;
      }
    }

    let roles = 0;
    for (const r of b.affiliations) {
      // The same role only when the dates match too: "Engineer, Acme"
      // 2020–2022 and "Engineer, Acme" since 2025 are two roles.
      const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? "";
      const same = a.affiliations.some(
        (x) =>
          x.organizationId === r.organizationId &&
          (x.role ?? "") === (r.role ?? "") &&
          day(x.startOn) === day(r.startOn) &&
          day(x.endOn) === day(r.endOn),
      );
      if (same) await tx.personAffiliation.delete({ where: { id: r.id } });
      else {
        await tx.personAffiliation.update({
          where: { id: r.id },
          data: { personId: a.id },
        });
        roles++;
      }
    }

    const links = await tx.personDocLink.findMany({
      where: { personId: b.id },
    });
    await tx.personDocLink.createMany({
      data: links.map((l) => ({ personId: a.id, docId: l.docId })),
      skipDuplicates: true,
    });
    await tx.personDocLink.deleteMany({ where: { personId: b.id } });

    // One participant per person per encounter; contact wins over mention.
    const parts = await tx.interactionParticipant.findMany({
      where: { personId: b.id },
    });
    for (const p of parts) {
      const mine = await tx.interactionParticipant.findUnique({
        where: {
          interactionId_personId: {
            interactionId: p.interactionId,
            personId: a.id,
          },
        },
      });
      await tx.interactionParticipant.delete({
        where: {
          interactionId_personId: {
            interactionId: p.interactionId,
            personId: b.id,
          },
        },
      });
      if (mine) {
        if (p.countsAsContact && !mine.countsAsContact) {
          await tx.interactionParticipant.update({
            where: {
              interactionId_personId: {
                interactionId: p.interactionId,
                personId: a.id,
              },
            },
            data: { countsAsContact: true },
          });
        }
      } else {
        await tx.interactionParticipant.create({
          data: {
            interactionId: p.interactionId,
            personId: a.id,
            countsAsContact: p.countsAsContact,
          },
        });
      }
    }

    await tx.personExternalIdentity.updateMany({
      where: { personId: b.id },
      data: { personId: a.id },
    });
    // Reconnect prompts follow the person; the survivor keeps its own cadence.
    await tx.peopleReconnect.updateMany({
      where: { personId: b.id },
      data: { personId: a.id },
    });

    await tx.person.update({
      where: { id: a.id },
      data: {
        displayName,
        summary: pick("summary"),
        location: pick("location"),
        howKnown: pick("howKnown"),
        aliases,
        contexts,
        customFields: fields,
      },
    });
    await tx.person.update({
      where: { id: b.id },
      data: { archivedAt: b.archivedAt ?? new Date(), mergedIntoId: a.id },
    });
    return {
      facts: facts.count,
      contacts,
      roles,
      notes: links.length,
      encounters: parts.length,
    };
  });
  console.info(
    `[people] merged person`,
    duplicateId,
    "into",
    survivorId,
    result,
  );
  return { survivorId, duplicateId, moved: result };
}
