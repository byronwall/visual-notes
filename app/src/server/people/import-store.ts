// CSV import: preview every row against current data, then apply rows one
// person at a time. Curated values always win; imports add what is missing
// and report disagreements. Applied rows are recorded so a retry resumes.
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { contactMatchValue, type ContactKind } from "~/lib/people/contacts";
import { parseCsv } from "~/lib/people/csv";
import {
  guessMapping,
  toImportRecord,
  type ImportMapping,
  type ImportRecord,
} from "~/lib/people/import-mapping";
import { prisma } from "~/server/db";
import { PeopleInputError } from "./errors";
import type { Db } from "./profile-store";

export type RowOutcome =
  | "create"
  | "update"
  | "unchanged"
  | "conflict"
  | "candidates"
  | "invalid";

export type RowPlan = {
  rowIndex: number;
  record: ImportRecord;
  outcome: RowOutcome;
  /** The matched person, for update / unchanged / conflict. */
  person: { id: string; displayName: string } | null;
  candidates: { id: string; displayName: string; evidence: string }[];
  /** What apply would add. */
  additions: string[];
  /** Curated values that differ from the file; apply keeps the curated one. */
  conflicts: { field: string; current: string; incoming: string }[];
  message: string | null;
  status: string;
};

/** Per-row decisions: an existing person id, "new", or "skip". */
export type ImportChoices = Record<number, string>;

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const lower = (v: string) => v.trim().toLowerCase();

function readRows(content: string, mapping: ImportMapping) {
  const [headers = [], ...rows] = parseCsv(content);
  return {
    headers,
    records: rows.map((row, i) => toImportRecord(headers, row, i + 1, mapping)),
  };
}

const RECORD_CONTACTS: [ContactKind, keyof ImportRecord][] = [
  ["email", "email"],
  ["phone", "phone"],
  ["url", "url"],
];

const PERSON_INCLUDE = {
  contacts: true,
  affiliations: { include: { organization: true } },
} satisfies Prisma.PersonInclude;
type PersonWithParts = Prisma.PersonGetPayload<{
  include: typeof PERSON_INCLUDE;
}>;

/** What importing `r` into `p` would add, and where they disagree. */
function diff(p: PersonWithParts, r: ImportRecord) {
  const additions: string[] = [];
  const conflicts: RowPlan["conflicts"] = [];
  if (lower(p.displayName) !== lower(r.displayName)) {
    conflicts.push({
      field: "name",
      current: p.displayName,
      incoming: r.displayName,
    });
  }
  for (const field of ["location", "summary"] as const) {
    const incoming = r[field];
    if (!incoming) continue;
    const current = p[field];
    if (!current) additions.push(field);
    else if (lower(current) !== lower(incoming)) {
      conflicts.push({ field, current, incoming });
    }
  }
  const have = new Set(p.contexts.map(lower));
  for (const c of r.contexts)
    if (!have.has(lower(c))) additions.push(`context ${c}`);
  for (const [kind, key] of RECORD_CONTACTS) {
    const value = r[key] as string | null;
    if (!value) continue;
    const match = contactMatchValue(kind, value);
    if (!p.contacts.some((c) => c.kind === kind && c.matchValue === match)) {
      additions.push(`${kind} ${value}`);
    }
  }
  if (r.organization) {
    const existing = p.affiliations.filter(
      (a) => lower(a.organization.name) === lower(r.organization!),
    );
    if (!existing.length) additions.push(`role at ${r.organization}`);
    else if (
      r.role &&
      !existing.some((a) => a.role && lower(a.role) === lower(r.role!))
    ) {
      conflicts.push({
        field: `role at ${r.organization}`,
        current: existing.map((a) => a.role ?? "no role").join(", "),
        incoming: r.role,
      });
    }
  }
  return { additions, conflicts };
}

/** Same-name or same-contact people: candidates only, never an automatic match. */
async function findCandidates(r: ImportRecord) {
  const contactOr = RECORD_CONTACTS.flatMap(([kind, key]) => {
    const v = r[key] as string | null;
    return v ? [{ kind, matchValue: contactMatchValue(kind, v) }] : [];
  });
  const people = await prisma.person.findMany({
    where: {
      archivedAt: null,
      OR: [
        { displayName: { equals: r.displayName, mode: "insensitive" } },
        ...(contactOr.length
          ? [{ contacts: { some: { OR: contactOr } } }]
          : []),
      ],
    },
    include: { contacts: true },
    take: 10,
  });
  return people.map((p) => {
    const shared = p.contacts
      .filter((c) =>
        contactOr.some(
          (o) => o.kind === c.kind && o.matchValue === c.matchValue,
        ),
      )
      .map((c) => `same ${c.kind}`);
    const evidence = [
      lower(p.displayName) === lower(r.displayName) ? "same name" : null,
      ...shared,
    ].filter(Boolean);
    return {
      id: p.id,
      displayName: p.displayName,
      evidence: evidence.join(", "),
    };
  });
}

async function loadPerson(id: string) {
  let person = await prisma.person.findUnique({
    where: { id },
    include: PERSON_INCLUDE,
  });
  // Follow a merge to the surviving profile.
  while (person?.mergedIntoId) {
    person = await prisma.person.findUnique({
      where: { id: person.mergedIntoId },
      include: PERSON_INCLUDE,
    });
  }
  return person;
}

/** Plans every row against current data. Nothing is written. */
async function planRows(
  source: string,
  records: ImportRecord[],
  choices: ImportChoices,
): Promise<RowPlan[]> {
  const seenKeys = new Map<string, number>();
  const plans: RowPlan[] = [];
  for (const r of records) {
    const base = {
      rowIndex: r.rowIndex,
      record: r,
      person: null,
      candidates: [],
      additions: [],
      conflicts: [],
      message: null,
      status: "pending",
    };
    if (!r.displayName) {
      plans.push({ ...base, outcome: "invalid", message: "Missing a name" });
      continue;
    }
    if (r.sourceKey && seenKeys.has(r.sourceKey)) {
      plans.push({
        ...base,
        outcome: "invalid",
        message: `Same key as row ${seenKeys.get(r.sourceKey)}`,
      });
      continue;
    }
    if (r.sourceKey) seenKeys.set(r.sourceKey, r.rowIndex);
    const choice = choices[r.rowIndex];
    if (choice === "skip") {
      plans.push({ ...base, outcome: "invalid", message: "Skipped" });
      continue;
    }
    const identity = r.sourceKey
      ? await prisma.personExternalIdentity.findUnique({
          where: { source_externalKey: { source, externalKey: r.sourceKey } },
        })
      : null;
    let personId = identity?.personId ?? null;
    if (choice && choice !== "new") {
      if (identity && identity.personId !== choice) {
        const owner = await loadPerson(identity.personId);
        plans.push({
          ...base,
          outcome: "conflict",
          message: `This row's key already belongs to ${owner?.displayName ?? "another person"}`,
        });
        continue;
      }
      personId = choice;
    }
    if (!personId) {
      const candidates = choice === "new" ? [] : await findCandidates(r);
      plans.push({
        ...base,
        outcome: candidates.length ? "candidates" : "create",
        candidates,
        message: candidates.length
          ? "Possible match: choose a person or create a new one"
          : null,
      });
      continue;
    }
    const person = await loadPerson(personId);
    if (!person) {
      plans.push({
        ...base,
        outcome: "invalid",
        message: `Person not found: ${personId}`,
      });
      continue;
    }
    const { additions, conflicts } = diff(person, r);
    plans.push({
      ...base,
      person: { id: person.id, displayName: person.displayName },
      outcome: conflicts.length
        ? "conflict"
        : additions.length
          ? "update"
          : "unchanged",
      additions,
      conflicts,
    });
  }
  return plans;
}

export async function previewImport(input: {
  source: string;
  fileName: string;
  content: string;
  mapping?: ImportMapping;
}) {
  const source = input.source.trim() || "csv";
  const [headers = []] = parseCsv(input.content.slice(0, 20_000));
  if (!headers.length) throw new PeopleInputError("The file has no header row");
  const mapping = input.mapping ?? guessMapping(headers);
  const row = await prisma.peopleImport.create({
    data: {
      source,
      fileName: input.fileName,
      fileHash: sha(input.content),
      content: input.content,
      mapping,
    },
  });
  console.info(`[people] import previewed`, row.id);
  return getImportPlan(row.id);
}

/** The current plan for an import, recomputed against today's data. */
export async function getImportPlan(
  importId: string,
  choices: ImportChoices = {},
) {
  const imp = await prisma.peopleImport.findUnique({
    where: { id: importId },
    include: { rows: true },
  });
  if (!imp)
    throw new PeopleInputError(`Import not found: ${importId}`, "not_found");
  const mapping = imp.mapping as ImportMapping;
  const { headers, records } = readRows(imp.content, mapping);
  const plans = await planRows(imp.source, records, choices);
  const saved = new Map(imp.rows.map((r) => [r.rowIndex, r]));
  for (const p of plans) {
    const row = saved.get(p.rowIndex);
    if (row) {
      p.status = row.status;
      if (row.status === "applied") p.message = row.message ?? p.message;
      if (row.status === "failed") p.message = row.message;
    }
  }
  const counts: Record<string, number> = {};
  for (const p of plans) counts[p.outcome] = (counts[p.outcome] ?? 0) + 1;
  return {
    id: imp.id,
    source: imp.source,
    fileName: imp.fileName,
    headers,
    mapping,
    appliedAt: imp.appliedAt?.toISOString() ?? null,
    counts,
    rows: plans,
  };
}

export async function setImportMapping(
  importId: string,
  mapping: ImportMapping,
) {
  await prisma.peopleImport.update({
    where: { id: importId },
    data: { mapping },
  });
  return getImportPlan(importId);
}

async function findOrCreateOrganization(db: Db, name: string) {
  const found = await db.organization.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return found ?? db.organization.create({ data: { name } });
}

/** Writes one planned row in its own transaction. */
async function applyRow(source: string, plan: RowPlan): Promise<string> {
  const r = plan.record;
  return prisma.$transaction(async (tx) => {
    let personId = plan.person?.id;
    if (plan.outcome === "create") {
      const created = await tx.person.create({
        data: {
          displayName: r.displayName,
          location: r.location,
          summary: r.summary,
          contexts: r.contexts,
        },
      });
      personId = created.id;
    } else if (personId) {
      const current = await tx.person.findUniqueOrThrow({
        where: { id: personId },
      });
      const have = new Set(current.contexts.map(lower));
      await tx.person.update({
        where: { id: personId },
        data: {
          // Only empty fields fill in; curated values stay.
          location: current.location ?? r.location,
          summary: current.summary ?? r.summary,
          contexts: [
            ...current.contexts,
            ...r.contexts.filter((c) => !have.has(lower(c))),
          ],
        },
      });
    }
    if (!personId) throw new Error("Nothing to apply");
    const contacts = await tx.personContact.findMany({ where: { personId } });
    for (const [kind, key] of RECORD_CONTACTS) {
      const value = r[key] as string | null;
      if (!value) continue;
      const matchValue = contactMatchValue(kind, value);
      if (contacts.some((c) => c.kind === kind && c.matchValue === matchValue))
        continue;
      await tx.personContact.create({
        data: {
          personId,
          kind,
          value,
          matchValue,
          label: `Imported (${source})`,
        },
      });
    }
    if (r.organization) {
      const org = await findOrCreateOrganization(tx, r.organization);
      const has = await tx.personAffiliation.count({
        where: { personId, organizationId: org.id },
      });
      if (!has) {
        await tx.personAffiliation.create({
          data: { personId, organizationId: org.id, role: r.role },
        });
      }
    }
    if (r.sourceKey) {
      await tx.personExternalIdentity.upsert({
        where: { source_externalKey: { source, externalKey: r.sourceKey } },
        create: { personId, source, externalKey: r.sourceKey },
        update: { lastImportedAt: new Date() },
      });
    }
    return personId;
  });
}

/**
 * Applies every row that is not applied yet: re-reads the file and re-plans
 * against current data first, so a stale preview cannot overwrite edits.
 */
export async function applyImport(
  importId: string,
  choices: ImportChoices = {},
) {
  const plan = await getImportPlan(importId, choices);
  let applied = 0;
  let failed = 0;
  let skipped = 0;
  for (const planned of plan.rows) {
    if (planned.status === "applied") continue;
    // Re-plan this row now, so an earlier row in the same file (a same-name
    // person just created) turns it into a candidate instead of a duplicate.
    const row =
      planned.outcome === "invalid"
        ? planned
        : (await planRows(plan.source, [planned.record], choices))[0];
    const writes = ["create", "update", "conflict", "unchanged"].includes(
      row.outcome,
    );
    const blocked = row.outcome === "conflict" && !row.person;
    if (!writes || blocked) {
      skipped++;
      await saveRow(importId, row, "skipped", row.message);
      continue;
    }
    try {
      const personId = await applyRow(plan.source, row);
      row.person = { id: personId, displayName: row.record.displayName };
      applied++;
      await saveRow(
        importId,
        row,
        "applied",
        row.conflicts.length
          ? `Kept ${row.conflicts.length} curated value(s)`
          : null,
      );
    } catch (err) {
      failed++;
      console.warn(`[people] import row failed`, importId, row.rowIndex);
      await saveRow(
        importId,
        row,
        "failed",
        err instanceof Error ? err.message.slice(0, 300) : "Failed",
      );
    }
  }
  await prisma.peopleImport.update({
    where: { id: importId },
    data: { appliedAt: new Date() },
  });
  console.info(`[people] import applied`, importId, {
    applied,
    failed,
    skipped,
  });
  return {
    applied,
    failed,
    skipped,
    plan: await getImportPlan(importId, choices),
  };
}

async function saveRow(
  importId: string,
  row: RowPlan,
  status: string,
  message: string | null,
) {
  await prisma.peopleImportRow.upsert({
    where: { importId_rowIndex: { importId, rowIndex: row.rowIndex } },
    create: {
      importId,
      rowIndex: row.rowIndex,
      status,
      outcome: row.outcome,
      personId: row.person?.id,
      message,
    },
    update: { status, outcome: row.outcome, personId: row.person?.id, message },
  });
}

export async function listImports() {
  const rows = await prisma.peopleImport.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      source: true,
      fileName: true,
      createdAt: true,
      appliedAt: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    appliedAt: r.appliedAt?.toISOString() ?? null,
  }));
}
