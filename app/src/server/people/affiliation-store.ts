// Roles at organizations: employment history and memberships. Dates keep the
// precision the source gave, status is stated rather than read from an empty
// end date, and each role can carry its source. Shared employers are compared
// by date and reported as context, never as relationships.
import type { Prisma } from "@prisma/client";
import {
  compareRoles,
  periodProblem,
  startKey,
  type AffiliationKind,
  type OverlapKind,
  type RoleStatus,
} from "~/lib/people/career-periods";
import { dayToDb, dbToDay, dbToDayOrNull } from "~/lib/people/dates";
import {
  affiliationInputSchema,
  affiliationPatchSchema,
  type AffiliationInput,
  type AffiliationPatch,
} from "~/lib/people/schemas";
import type { Affiliation, Colleague } from "~/lib/people/types";
import { prisma } from "~/server/db";
import { PeopleInputError } from "./errors";
import type { Db } from "./profile-store";

const blankToNull = (v: string | null | undefined) =>
  v === undefined ? undefined : v?.trim() || null;
const dayOrNull = (v: string | null | undefined) =>
  v === undefined ? undefined : v ? dayToDb(v) : null;

export const AFFILIATION_INCLUDE = {
  organization: {
    select: { id: true, name: true, kind: true, url: true, summary: true },
  },
  sourceDoc: { select: { id: true, title: true, path: true } },
} satisfies Prisma.PersonAffiliationInclude;

export type AffiliationRow = Prisma.PersonAffiliationGetPayload<{
  include: typeof AFFILIATION_INCLUDE;
}>;

export const toAffiliation = (a: AffiliationRow): Affiliation => ({
  id: a.id,
  organization: a.organization,
  kind: a.kind,
  status: a.status,
  role: a.role,
  startOn: a.startOn,
  startApprox: a.startApprox,
  endOn: a.endOn,
  endApprox: a.endApprox,
  observedOn: dbToDayOrNull(a.observedOn),
  recordedOn: dbToDay(a.createdAt),
  responsibilities: a.responsibilities,
  location: a.location,
  sourceLabel: a.sourceLabel,
  sourceUrl: a.sourceUrl,
  source: a.sourceDoc,
  sourceKey: a.sourceKey,
});

const STATUS_ORDER: Record<RoleStatus, number> = {
  current: 0,
  ended: 1,
  unknown: 2,
};

/** Newest start first; undated roles last; current before ended on ties. */
export const sortAffiliations = (list: Affiliation[]) =>
  [...list].sort(
    (a, b) =>
      startKey(b).localeCompare(startKey(a)) ||
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  );

export const isCurrent = (a: { status: RoleStatus }) => a.status === "current";

export const roleLabel = (a: Pick<Affiliation, "role" | "organization">) =>
  a.role ? `${a.role}, ${a.organization.name}` : a.organization.name;

function check(p: Parameters<typeof periodProblem>[0]) {
  const problem = periodProblem(p);
  if (problem) throw new PeopleInputError(problem);
}

async function requireSourceDoc(db: Db, id: string | null | undefined) {
  if (!id) return;
  const doc = await db.doc.findUnique({ where: { id }, select: { id: true } });
  if (!doc) throw new PeopleInputError(`Note not found: ${id}`, "not_found");
}

/** Column values shared by add and update; undefined leaves a field alone. */
function columns(p: AffiliationPatch) {
  return {
    kind: p.kind,
    status: p.status,
    role: blankToNull(p.role),
    startOn: blankToNull(p.startOn),
    startApprox: p.startApprox,
    endOn: blankToNull(p.endOn),
    endApprox: p.endApprox,
    observedOn: dayOrNull(p.observedOn),
    responsibilities: blankToNull(p.responsibilities),
    location: blankToNull(p.location),
    sourceLabel: blankToNull(p.sourceLabel),
    sourceUrl: blankToNull(p.sourceUrl),
    sourceDocId: p.sourceDocId === undefined ? undefined : p.sourceDocId || null,
  };
}

/**
 * Adds a role. With a sourceKey, repeating the add returns the role made the
 * first time instead of a duplicate. A stated end day implies "ended".
 */
export async function addAffiliation(
  personId: string,
  input: AffiliationInput,
  db: Db = prisma,
): Promise<Affiliation> {
  const parsed = affiliationInputSchema.parse(input);
  const status = parsed.status ?? (parsed.endOn ? "ended" : "unknown");
  check({ ...parsed, status });
  if (parsed.sourceKey) {
    const prior = await db.personAffiliation.findUnique({
      where: { sourceKey: parsed.sourceKey },
      include: AFFILIATION_INCLUDE,
    });
    if (prior && prior.personId !== personId) {
      throw new PeopleInputError(
        `Source key ${parsed.sourceKey} already belongs to another person's role`,
        "invalid",
      );
    }
    if (prior) return toAffiliation(prior);
  }
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
  await requireSourceDoc(db, parsed.sourceDocId);
  const row = await db.personAffiliation.create({
    data: {
      ...columns(parsed),
      status,
      personId,
      organizationId: parsed.organizationId,
      sourceKey: parsed.sourceKey || null,
    },
    include: AFFILIATION_INCLUDE,
  });
  return toAffiliation(row);
}

/** Corrects or ends a role. Recording an end keeps the history. */
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
  const endOn = parsed.endOn === undefined ? current.endOn : parsed.endOn;
  // Adding an end day ends the role unless a status is given, as on add.
  const status = parsed.status ?? (parsed.endOn ? "ended" : current.status);
  check({
    status,
    startOn: parsed.startOn === undefined ? current.startOn : parsed.startOn,
    endOn,
  });
  await requireSourceDoc(db, parsed.sourceDocId);
  if (parsed.sourceKey) {
    const other = await db.personAffiliation.findUnique({
      where: { sourceKey: parsed.sourceKey },
      select: { id: true },
    });
    if (other && other.id !== id)
      throw new PeopleInputError(
        `Source key ${parsed.sourceKey} is already used by another role`,
        "invalid",
      );
  }
  const row = await db.personAffiliation.update({
    where: { id },
    data: {
      ...columns(parsed),
      status,
      sourceKey:
        parsed.sourceKey === undefined ? undefined : parsed.sourceKey || null,
    },
    include: AFFILIATION_INCLUDE,
  });
  return toAffiliation(row);
}

/** Removes a wrong association. To record that a role ended, mark it ended. */
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

/** "Role, Organization" for each person's newest current role, jobs first. */
export async function currentRoles(
  personIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!personIds.length) return out;
  const rows = await prisma.personAffiliation.findMany({
    where: {
      personId: { in: personIds },
      organization: { archivedAt: null },
      status: "current",
    },
    include: AFFILIATION_INCLUDE,
  });
  const owner = new Map(rows.map((r) => [r.id, r.personId]));
  const ordered = sortAffiliations(rows.map(toAffiliation)).sort(
    (a, b) => Number(a.kind !== "employment") - Number(b.kind !== "employment"),
  );
  for (const a of ordered) {
    const personId = owner.get(a.id)!;
    if (!out.has(personId)) out.set(personId, roleLabel(a));
  }
  return out;
}

const RANK: Record<OverlapKind, number> = {
  overlap: 0,
  possible: 1,
  unknown: 2,
  none: 3,
};

/**
 * Other people employed at the same organizations as these roles, with the
 * best dated comparison per person and organization. Pairs whose periods are
 * apart are left out. A result is a lead, not evidence of acquaintance.
 */
export async function findColleagues(
  roles: Affiliation[],
  excludePersonId: string,
  /** Limit the comparison to these people. */
  onlyPersonIds?: string[],
  /** Role kinds to compare; jobs by default. */
  kinds: AffiliationKind[] = ["employment"],
): Promise<Colleague[]> {
  const jobs = roles.filter((r) => kinds.includes(r.kind));
  if (onlyPersonIds && !onlyPersonIds.length) return [];
  if (!jobs.length) return [];
  const others = await prisma.personAffiliation.findMany({
    where: {
      kind: { in: kinds },
      organizationId: { in: [...new Set(jobs.map((j) => j.organization.id))] },
      personId: onlyPersonIds
        ? { in: onlyPersonIds.filter((id) => id !== excludePersonId) }
        : { not: excludePersonId },
      person: { archivedAt: null },
    },
    include: {
      ...AFFILIATION_INCLUDE,
      person: { select: { id: true, displayName: true } },
    },
  });
  const best = new Map<string, Colleague>();
  for (const o of others) {
    const other = toAffiliation(o);
    for (const job of jobs) {
      if (job.organization.id !== other.organization.id) continue;
      const overlap = compareRoles(job, other);
      if (overlap.kind === "none") continue;
      const key = `${o.person.id}:${other.organization.id}`;
      const prev = best.get(key);
      if (!prev || RANK[overlap.kind] < RANK[prev.overlap.kind]) {
        best.set(key, { affiliationId: job.id, person: o.person, other, overlap });
      }
    }
  }
  return [...best.values()].sort(
    (a, b) =>
      RANK[a.overlap.kind] - RANK[b.overlap.kind] ||
      a.person.displayName.localeCompare(b.person.displayName),
  );
}
