import { query } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { prisma } from "~/server/db";
import {
  followupDigest,
  listFollowups,
  type FollowupStatus,
} from "~/server/people/reconnect-store";
import {
  getImportPlan,
  listImports,
  type ImportChoices,
} from "~/server/people/import-store";
import {
  findDuplicates,
  listDuplicateGroups,
} from "~/server/people/merge-store";
import {
  getOrganization,
  listOrganizations,
} from "~/server/people/organization-store";
import type { PeopleListInput } from "~/lib/people/schemas";
import {
  findPeopleByName,
  getPersonProfile,
  listPeople,
  listPeopleContexts,
} from "~/server/people/person-store";

export const fetchPeople = query(async (input: PeopleListInput) => {
  "use server";
  return listPeople(input ?? {});
}, "people-list");

export const fetchPerson = query(async (id: string) => {
  "use server";
  return getPersonProfile(id);
}, "people-person");

export const fetchPeopleContexts = query(async () => {
  "use server";
  return listPeopleContexts();
}, "people-contexts");

/** Name and alias matches for the capture person picker. */
export const fetchPersonCandidates = query(async (name: string) => {
  "use server";
  return findPeopleByName(name ?? "", 8);
}, "people-candidates");

export const fetchOrganizations = query(
  async (input: { search?: string; archived?: boolean }) => {
    "use server";
    return listOrganizations(input ?? {});
  },
  "people-organizations",
);

export const fetchOrganization = query(async (id: string) => {
  "use server";
  return getOrganization(id);
}, "people-organization");

/** Notes by title, for linking one to a profile or organization. */
export const fetchNoteCandidates = query(async (q: string) => {
  "use server";
  const term = (q ?? "").trim();
  if (!term) return [];
  return prisma.doc.findMany({
    where: { archivedAt: null, title: { contains: term, mode: "insensitive" } },
    select: { id: true, title: true, path: true },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });
}, "people-note-candidates");

export const fetchImportPlan = query(
  async (input: { id: string; choices?: ImportChoices }) => {
    "use server";
    return getImportPlan(input.id, input.choices ?? {});
  },
  "people-import-plan",
);

export const fetchImports = query(async () => {
  "use server";
  return listImports();
}, "people-imports");

export const fetchDuplicates = query(async (personId: string) => {
  "use server";
  return findDuplicates(personId);
}, "people-duplicates");

export const fetchDuplicateGroups = query(async () => {
  "use server";
  return listDuplicateGroups();
}, "people-duplicate-groups");

export const fetchFollowups = query(
  async (input: {
    upcomingDays?: number;
    include?: FollowupStatus[];
    personId?: string;
  }) => {
    "use server";
    return listFollowups(input ?? {});
  },
  "people-followups",
);

/** The due queue as plain text with links, for copying elsewhere. */
export const fetchFollowupDigest = query(async () => {
  "use server";
  const origin = new URL(getRequestEvent()?.request.url ?? "http://localhost")
    .origin;
  return followupDigest(await listFollowups(), origin);
}, "people-followup-digest");
