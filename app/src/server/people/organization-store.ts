// Organizations: companies, schools, churches, teams. Shared membership is
// context only; nothing here treats two members as acquainted.
import type { Prisma } from "@prisma/client";
import { dbToDayOrNull, todayLocal } from "~/lib/people/dates";
import {
  organizationInputSchema,
  organizationPatchSchema,
  type OrganizationInput,
  type OrganizationPatch,
} from "~/lib/people/schemas";
import type {
  OrganizationDetail,
  OrganizationSummary,
} from "~/lib/people/types";
import { prisma } from "~/server/db";
import { PeopleInputError, withRequestKey } from "./errors";

const ORG_INCLUDE = {
  affiliations: {
    select: {
      personId: true,
      endOn: true,
      person: { select: { archivedAt: true } },
    },
  },
} satisfies Prisma.OrganizationInclude;
type OrgRow = Prisma.OrganizationGetPayload<{ include: typeof ORG_INCLUDE }>;

const blankToNull = (v: string | null | undefined) =>
  v === undefined ? undefined : v?.trim() || null;

const toSummary = (o: OrgRow): OrganizationSummary => {
  const today = todayLocal();
  // Count people, not roles: two current roles are one current member, and
  // someone with a current role is not also a past member.
  const active = o.affiliations.filter((a) => !a.person.archivedAt);
  const currentIds = new Set(
    active
      .filter((a) => !a.endOn || (dbToDayOrNull(a.endOn) ?? "") >= today)
      .map((a) => a.personId),
  );
  const pastIds = new Set(
    active.map((a) => a.personId).filter((id) => !currentIds.has(id)),
  );
  return {
    id: o.id,
    name: o.name,
    kind: o.kind,
    summary: o.summary,
    url: o.url,
    currentMembers: currentIds.size,
    pastMembers: pastIds.size,
    archivedAt: o.archivedAt?.toISOString() ?? null,
  };
};

async function requireDoc(id: string | null | undefined) {
  if (!id) return;
  const doc = await prisma.doc.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!doc) throw new PeopleInputError(`Note not found: ${id}`, "not_found");
}

export async function listOrganizations(
  input: { search?: string; archived?: boolean; limit?: number } = {},
): Promise<OrganizationSummary[]> {
  const q = input.search?.trim();
  const rows = await prisma.organization.findMany({
    where: {
      archivedAt: input.archived ? { not: null } : null,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    include: ORG_INCLUDE,
    orderBy: { name: "asc" },
    take: Math.min(input.limit ?? 200, 500),
  });
  return rows.map(toSummary);
}

export async function getOrganization(
  id: string,
): Promise<OrganizationDetail | null> {
  const row = await prisma.organization.findUnique({
    where: { id },
    include: {
      ...ORG_INCLUDE,
      doc: { select: { id: true, title: true, path: true } },
    },
  });
  if (!row) return null;
  const members = await prisma.personAffiliation.findMany({
    where: { organizationId: id },
    include: {
      person: { select: { id: true, displayName: true, archivedAt: true } },
    },
  });
  const today = todayLocal();
  const list = members
    .map((m) => ({
      id: m.person.id,
      displayName: m.person.displayName,
      affiliationId: m.id,
      role: m.role,
      startOn: dbToDayOrNull(m.startOn),
      endOn: dbToDayOrNull(m.endOn),
      archived: !!m.person.archivedAt,
    }))
    .sort((a, b) => {
      const aPast = a.endOn != null && a.endOn < today;
      const bPast = b.endOn != null && b.endOn < today;
      if (aPast !== bPast) return aPast ? 1 : -1;
      return a.displayName.localeCompare(b.displayName);
    });
  return { ...toSummary(row), note: row.doc, members: list };
}

export async function createOrganization(
  input: OrganizationInput,
): Promise<{ organization: OrganizationSummary; existing: boolean }> {
  const parsed = organizationInputSchema.parse(input);
  const { record, existing } = await withRequestKey(
    parsed.requestKey,
    (requestKey) =>
      prisma.organization.findUnique({
        where: { requestKey },
        include: ORG_INCLUDE,
      }),
    async () => {
      await requireDoc(parsed.docId);
      return prisma.organization.create({
        data: {
          name: parsed.name,
          kind: blankToNull(parsed.kind),
          summary: blankToNull(parsed.summary),
          url: blankToNull(parsed.url),
          docId: parsed.docId || null,
          requestKey: parsed.requestKey,
        },
        include: ORG_INCLUDE,
      });
    },
  );
  console.info(
    `[people] ${existing ? "reused" : "created"} organization`,
    record.id,
  );
  return { organization: toSummary(record), existing };
}

export async function updateOrganization(
  id: string,
  patch: OrganizationPatch,
): Promise<{ organization: OrganizationSummary; changed: string[] }> {
  const parsed = organizationPatchSchema.parse(patch);
  const current = await prisma.organization.findUnique({ where: { id } });
  if (!current) {
    throw new PeopleInputError(`Organization not found: ${id}`, "not_found");
  }
  await requireDoc(parsed.docId);
  const data: Prisma.OrganizationUpdateInput = {
    name: parsed.name,
    kind: blankToNull(parsed.kind),
    summary: blankToNull(parsed.summary),
    url: blankToNull(parsed.url),
    doc:
      parsed.docId === undefined
        ? undefined
        : parsed.docId
          ? { connect: { id: parsed.docId } }
          : { disconnect: true },
    archivedAt:
      parsed.archived === undefined
        ? undefined
        : parsed.archived
          ? current.archivedAt ?? new Date()
          : null,
  };
  const changed = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k]) =>
      k === "archivedAt" ? "archived" : k === "doc" ? "docId" : k,
    );
  const row = await prisma.organization.update({
    where: { id },
    data,
    include: ORG_INCLUDE,
  });
  console.info(`[people] updated organization`, id, changed.join(","));
  return { organization: toSummary(row), changed };
}
