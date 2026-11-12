import { Prisma } from "@prisma/client";
import { dbToDay } from "~/lib/people/dates";
import { prisma } from "~/server/db";

/**
 * Latest recorded contact per person: the newest active interaction where
 * the person counts as contact. Facts, profile edits, and mentions never
 * count. Computed on read; no cache until one is measured to be needed.
 */
export async function lastContactByPerson(
  personIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!personIds.length) return out;
  const rows = await prisma.$queryRaw<{ personId: string; last: Date }[]>`
    SELECT ip."personId" AS "personId", max(i."occurredOn") AS "last"
    FROM "InteractionParticipant" ip
    JOIN "Interaction" i ON i.id = ip."interactionId"
    WHERE ip."countsAsContact" AND i."archivedAt" IS NULL
      AND ip."personId" IN (${Prisma.join(personIds)})
    GROUP BY ip."personId"`;
  for (const row of rows) out.set(row.personId, dbToDay(row.last));
  return out;
}
