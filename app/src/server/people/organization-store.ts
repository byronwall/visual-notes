// Organizations: companies, schools, churches, teams. Shared membership is
// context only; nothing here treats two members as acquainted.
import type { Prisma } from "@prisma/client";
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
import {
  AFFILIATION_INCLUDE,
  sortAffiliations,
  toAffiliation,
} from "./affiliation-store";
import { PeopleInputError, withRequestKey } from "./errors";

const ORG_INCLUDE = {
  affiliations: {
    select: {
      personId: true,
      status: true,
      person: { select: { archivedAt: true } },
    },
  },
} satisfies Prisma.OrganizationInclude;
// Icon bytes are served by /api/org-icons, never loaded with a page.
type OrgRow = Prisma.OrganizationGetPayload<{
  include: typeof ORG_INCLUDE;
  omit: { iconData: true };
}>;

const blankToNull = (v: string | null | undefined) =>
  v === undefined ? undefined : v?.trim() || null;

const toSummary = (o: OrgRow): OrganizationSummary => {
  // Count people, not roles: two current roles are one current member, and
  // someone with a current role is not also a past member. A listing with
  // unknown status is neither: it was never confirmed current.
  const active = o.affiliations.filter((a) => !a.person.archivedAt);
  const ids = (status: string) =>
    new Set(active.filter((a) => a.status === status).map((a) => a.personId));
  const currentIds = ids("current");
  const pastIds = new Set(
    [...ids("ended")].filter((id) => !currentIds.has(id)),
  );
  const unknownIds = new Set(
    [...ids("unknown")].filter((id) => !currentIds.has(id) && !pastIds.has(id)),
  );
  return {
    id: o.id,
    name: o.name,
    kind: o.kind,
    summary: o.summary,
    url: o.url,
    currentMembers: currentIds.size,
    pastMembers: pastIds.size,
    unknownMembers: unknownIds.size,
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
        omit: { iconData: true },
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
    omit: { iconData: true },
  });
  if (!row) return null;
  const members = await prisma.personAffiliation.findMany({
    where: { organizationId: id },
    include: {
      ...AFFILIATION_INCLUDE,
      person: { select: { id: true, displayName: true, archivedAt: true } },
    },
  });
  const byId = new Map(members.map((m) => [m.id, m.person]));
  // Newest start first, as on a profile, so people from one era sit together.
  const list = sortAffiliations(members.map(toAffiliation)).map((a) => {
    const person = byId.get(a.id)!;
    return {
      id: person.id,
      displayName: person.displayName,
      affiliationId: a.id,
      affiliation: a,
      archived: !!person.archivedAt,
    };
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
        omit: { iconData: true },
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
        omit: { iconData: true },
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
  // A new website gets its icon looked up again.
  const newSite =
    parsed.url !== undefined && (parsed.url?.trim() || null) !== current.url;
  const data: Prisma.OrganizationUpdateInput = {
    ...(newSite ? { iconData: null, iconType: null, iconCheckedAt: null } : {}),
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
    .filter(([k, v]) => v !== undefined && !k.startsWith("icon"))
    .map(([k]) =>
      k === "archivedAt" ? "archived" : k === "doc" ? "docId" : k,
    );
  const row = await prisma.organization.update({
    where: { id },
    data,
    include: ORG_INCLUDE,
        omit: { iconData: true },
  });
  console.info(`[people] updated organization`, id, changed.join(","));
  return { organization: toSummary(row), changed };
}
