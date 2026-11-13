// Reviewed import of a career-history collection into native People roles.
// Preview plans every row against current data; apply re-plans and writes
// one row per transaction, so a repeat or a resumed run creates nothing
// twice. Roles are keyed by their collection row; curated edits win and come
// back as conflicts. Companies match by exact name only: two organizations
// with the same name are reported, never merged. No notes are written, so
// nothing reaches Recent, and contact dates are untouched.
import { formatValueText, readValue } from "~/lib/collections/values";
import {
  LINKEDIN_SOURCE,
  careerRowKey,
  parseCareerRow,
  type CareerRecord,
} from "~/lib/people/career-import";
import { dayToDb } from "~/lib/people/dates";
import { prisma } from "~/server/db";
import {
  ROW_SELECT,
  loadLiveProperties,
  mapRow,
} from "~/services/collections/collections.server";
import type { Db } from "./profile-store";

export type CareerOutcome =
  | "create"
  | "adopt"
  | "unchanged"
  | "conflict"
  | "invalid";

export type CareerPlan = {
  rowId: string;
  outcome: CareerOutcome;
  record: CareerRecord | null;
  person: { id: string; displayName: string } | null;
  /** Existing organization, or null when apply would create one. */
  organizationId: string | null;
  /** The role this row maps to, once it exists. */
  affiliationId: string | null;
  message: string | null;
};

const lower = (v: string | null | undefined) => v?.trim().toLowerCase() ?? "";

/** Collection rows as text values by property name; dates as YYYY-MM-DD. */
async function readRows(collectionId: string) {
  const properties = await loadLiveProperties(collectionId);
  const rows = (
    await prisma.doc.findMany({
      where: { collectionId },
      select: ROW_SELECT,
      orderBy: [{ collectionRank: "asc" }, { createdAt: "asc" }],
    })
  ).map(mapRow);
  return rows.map((row) => {
    const values: Record<string, string> = {};
    for (const p of properties) {
      const v = readValue(row, p);
      values[p.name] =
        p.kind === "date" && v && typeof v === "object" && "start" in v
          ? String(v.start).slice(0, 10)
          : formatValueText(p, v);
    }
    return { id: row.id, values };
  });
}

/** Stored role fields that an import compares against its row. */
const ROLE_FIELDS = ["role", "startOn", "endOn", "status"] as const;

async function planRow(
  db: Db,
  rowId: string,
  values: Record<string, string>,
): Promise<CareerPlan> {
  const base = {
    rowId,
    record: null,
    person: null,
    organizationId: null,
    affiliationId: null,
  };
  const parsed = parseCareerRow(rowId, values);
  if ("problem" in parsed)
    return { ...base, outcome: "invalid", message: parsed.problem };
  const r = parsed.record;
  const person = await db.person.findUnique({
    where: { id: r.personId },
    select: { id: true, displayName: true, archivedAt: true, mergedIntoId: true },
  });
  if (!person || person.archivedAt) {
    return {
      ...base,
      record: r,
      outcome: "invalid",
      message: person?.mergedIntoId
        ? `Profile was merged into ${person.mergedIntoId}; update the row's Person URL`
        : "Person URL names no active profile",
    };
  }
  const who = { id: person.id, displayName: person.displayName };
  const plan = { ...base, record: r, person: who };
  if (r.profileKey) {
    const identity = await db.personExternalIdentity.findUnique({
      where: {
        source_externalKey: { source: LINKEDIN_SOURCE, externalKey: r.profileKey },
      },
    });
    if (identity && identity.personId !== person.id)
      return {
        ...plan,
        outcome: "conflict",
        message: `LinkedIn profile ${r.profileKey} belongs to another person (${identity.personId})`,
      };
  }
  const orgs = await db.organization.findMany({
    where: { archivedAt: null, name: { equals: r.company, mode: "insensitive" } },
    select: { id: true },
  });
  if (orgs.length > 1)
    return {
      ...plan,
      outcome: "conflict",
      message: `${orgs.length} organizations are named "${r.company}"; merge or rename them first`,
    };
  const organizationId = orgs[0]?.id ?? null;

  const keyed = await db.personAffiliation.findUnique({
    where: { sourceKey: careerRowKey(rowId) },
  });
  if (keyed) {
    const differs = ROLE_FIELDS.filter((f) => lower(keyed[f]) !== lower(r[f]));
    return {
      ...plan,
      organizationId: keyed.organizationId,
      affiliationId: keyed.id,
      outcome: differs.length ? "conflict" : "unchanged",
      message: differs.length
        ? `Kept the edited role; it differs in ${differs.join(", ")}`
        : null,
    };
  }
  if (!organizationId)
    return { ...plan, outcome: "create", message: `New organization "${r.company}"` };

  // An undated, unsourced role with the same title is the export listing
  // this row describes in full; anything else is a separate role or stint.
  const legacy = await db.personAffiliation.findMany({
    where: {
      personId: person.id,
      organizationId,
      kind: "employment",
      sourceKey: null,
      startOn: null,
      endOn: null,
    },
  });
  const same = legacy.filter((a) => !a.role || lower(a.role) === lower(r.role));
  if (same.length > 1)
    return {
      ...plan,
      organizationId,
      outcome: "conflict",
      message: `${same.length} undated roles at ${r.company} could be this one`,
    };
  if (same.length === 1)
    return {
      ...plan,
      organizationId,
      affiliationId: same[0].id,
      outcome: "adopt",
      message: "Adds dates and source to the existing undated role",
    };
  return { ...plan, organizationId, outcome: "create", message: null };
}

/** Every row's plan, with nothing written. */
export async function previewCareerImport(collectionId: string) {
  const rows = await readRows(collectionId);
  const plans: CareerPlan[] = [];
  for (const row of rows) plans.push(await planRow(prisma, row.id, row.values));
  return summarize(plans);
}

function summarize(plans: CareerPlan[]) {
  const counts: Record<CareerOutcome, number> = {
    create: 0,
    adopt: 0,
    unchanged: 0,
    conflict: 0,
    invalid: 0,
  };
  for (const p of plans) counts[p.outcome]++;
  return { counts, rows: plans };
}

async function writeRow(tx: Db, plan: CareerPlan): Promise<string> {
  const r = plan.record!;
  let organizationId = plan.organizationId;
  if (!organizationId) {
    const requestKey = `career-org:${lower(r.company)}`;
    // An archived copy keeps its key; the new one is made without it.
    const prior = await tx.organization.findUnique({ where: { requestKey } });
    const org =
      prior && !prior.archivedAt
        ? prior
        : await tx.organization.create({
            data: {
              name: r.company,
              kind: "company",
              requestKey: prior ? null : requestKey,
            },
          });
    organizationId = org.id;
  }
  const fields = {
    kind: "employment" as const,
    status: r.status,
    role: r.role,
    startOn: r.startOn,
    endOn: r.endOn,
    location: r.location,
    observedOn: r.observedOn ? dayToDb(r.observedOn) : null,
    sourceLabel: "LinkedIn",
    sourceUrl: r.sourceUrl,
    sourceKey: careerRowKey(r.rowId),
  };
  const role =
    plan.outcome === "adopt"
      ? await tx.personAffiliation.update({
          where: { id: plan.affiliationId! },
          data: fields,
        })
      : await tx.personAffiliation.create({
          data: { ...fields, personId: r.personId, organizationId },
        });
  if (r.profileKey) {
    const key = { source: LINKEDIN_SOURCE, externalKey: r.profileKey };
    await tx.personExternalIdentity.upsert({
      where: { source_externalKey: key },
      create: { ...key, personId: r.personId },
      update: { lastImportedAt: new Date() },
    });
  }
  return role.id;
}

/**
 * Applies create and adopt rows, re-planning each inside its transaction.
 * `limit` applies only the first N writable rows (try one profile first).
 * Conflicts and invalid rows are reported and left alone.
 */
export async function applyCareerImport(
  collectionId: string,
  opts: { limit?: number } = {},
) {
  const rows = await readRows(collectionId);
  const plans: CareerPlan[] = [];
  let written = 0;
  for (const row of rows) {
    if (opts.limit != null && written >= opts.limit) {
      plans.push(await planRow(prisma, row.id, row.values));
      continue;
    }
    const plan = await prisma.$transaction(async (tx) => {
      const p = await planRow(tx, row.id, row.values);
      if (p.outcome !== "create" && p.outcome !== "adopt") return p;
      const affiliationId = await writeRow(tx, p);
      return { ...p, affiliationId };
    });
    if (plan.outcome === "create" || plan.outcome === "adopt") written++;
    plans.push(plan);
  }
  console.info(
    "[people] career import applied",
    collectionId,
    `${written} written of ${rows.length}`,
  );
  return { written, ...summarize(plans) };
}
