// Explicit person-to-person relationships, the focused network around one
// person, and introduction paths. Paths use only active explicit edges;
// shared organizations appear separately as possible leads.
import type { Prisma } from "@prisma/client";
import { dayToDb, dbToDayOrNull } from "~/lib/people/dates";
import {
  RELATIONSHIP_KINDS,
  labelFor,
  normalizeEdge,
  type RelationshipKind,
} from "~/lib/people/relationships";
import { prisma } from "~/server/db";
import { PeopleInputError } from "./errors";

export type RelationshipView = {
  id: string;
  type: RelationshipKind;
  /** Label from the viewer's side, e.g. "Mentee of". */
  label: string;
  other: { id: string; displayName: string };
  fromPersonId: string;
  toPersonId: string;
  source: string | null;
  startOn: string | null;
  endOn: string | null;
  archived: boolean;
};

const EDGE_INCLUDE = {
  from: { select: { id: true, displayName: true, archivedAt: true } },
  to: { select: { id: true, displayName: true, archivedAt: true } },
} satisfies Prisma.PersonRelationshipInclude;
type EdgeRow = Prisma.PersonRelationshipGetPayload<{
  include: typeof EDGE_INCLUDE;
}>;

const checkType = (type: string): RelationshipKind => {
  if (!(RELATIONSHIP_KINDS as string[]).includes(type)) {
    throw new PeopleInputError(
      `Invalid relationship type: ${type}. Use ${RELATIONSHIP_KINDS.join(", ")}`,
    );
  }
  return type as RelationshipKind;
};

export const toView = (e: EdgeRow, viewerId: string): RelationshipView => {
  const type = e.type as RelationshipKind;
  const other = e.fromPersonId === viewerId ? e.to : e.from;
  return {
    id: e.id,
    type,
    label: labelFor(type, e, viewerId),
    other: { id: other.id, displayName: other.displayName },
    fromPersonId: e.fromPersonId,
    toPersonId: e.toPersonId,
    source: e.source,
    startOn: dbToDayOrNull(e.startOn),
    endOn: dbToDayOrNull(e.endOn),
    archived: !!e.archivedAt,
  };
};

export async function listRelationships(
  personId: string,
  includeArchived = false,
) {
  const rows = await prisma.personRelationship.findMany({
    where: {
      OR: [{ fromPersonId: personId }, { toPersonId: personId }],
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    include: EDGE_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => toView(r, personId));
}

/**
 * Adds an explicit relationship. `fromPersonId` is the subject of a directed
 * type ("A is mentor of B"). Re-adding an archived edge restores it.
 */
export async function addRelationship(input: {
  fromPersonId: string;
  toPersonId: string;
  type: string;
  source?: string | null;
  startOn?: string | null;
  endOn?: string | null;
}) {
  const type = checkType(input.type);
  let edge: { from: string; to: string };
  try {
    edge = normalizeEdge(type, input.fromPersonId, input.toPersonId);
  } catch (err) {
    throw new PeopleInputError((err as Error).message);
  }
  const found = await prisma.person.count({
    where: { id: { in: [edge.from, edge.to] } },
  });
  if (found !== 2) throw new PeopleInputError("Person not found", "not_found");
  const data = {
    source: input.source?.trim() || null,
    startOn: input.startOn ? dayToDb(input.startOn) : null,
    endOn: input.endOn ? dayToDb(input.endOn) : null,
  };
  const row = await prisma.personRelationship.upsert({
    where: {
      fromPersonId_toPersonId_type: {
        fromPersonId: edge.from,
        toPersonId: edge.to,
        type,
      },
    },
    create: { fromPersonId: edge.from, toPersonId: edge.to, type, ...data },
    update: { ...data, archivedAt: null },
    include: EDGE_INCLUDE,
  });
  console.info(`[people] added relationship`, row.id, type);
  return toView(row, input.fromPersonId);
}

/** Corrects dates or source, or archives / restores one relationship. */
export async function updateRelationship(
  id: string,
  patch: {
    source?: string | null;
    startOn?: string | null;
    endOn?: string | null;
    archived?: boolean;
  },
  viewerId?: string,
) {
  const current = await prisma.personRelationship.findUnique({ where: { id } });
  if (!current)
    throw new PeopleInputError(`Relationship not found: ${id}`, "not_found");
  const row = await prisma.personRelationship.update({
    where: { id },
    data: {
      source:
        patch.source === undefined ? undefined : patch.source?.trim() || null,
      startOn:
        patch.startOn === undefined
          ? undefined
          : patch.startOn
            ? dayToDb(patch.startOn)
            : null,
      endOn:
        patch.endOn === undefined
          ? undefined
          : patch.endOn
            ? dayToDb(patch.endOn)
            : null,
      archivedAt:
        patch.archived === undefined
          ? undefined
          : patch.archived
            ? current.archivedAt ?? new Date()
            : null,
    },
    include: EDGE_INCLUDE,
  });
  return toView(row, viewerId ?? row.fromPersonId);
}

type Edge = {
  id: string;
  a: string;
  b: string;
  type: RelationshipKind;
  source: string | null;
  fromPersonId: string;
};

/** All active edges between active people, as an adjacency list. */
async function loadGraph() {
  const rows = await prisma.personRelationship.findMany({
    where: {
      archivedAt: null,
      from: { archivedAt: null },
      to: { archivedAt: null },
    },
    select: {
      id: true,
      fromPersonId: true,
      toPersonId: true,
      type: true,
      source: true,
    },
  });
  const adj = new Map<string, Edge[]>();
  for (const r of rows) {
    const edge: Edge = {
      id: r.id,
      a: r.fromPersonId,
      b: r.toPersonId,
      type: r.type as RelationshipKind,
      source: r.source,
      fromPersonId: r.fromPersonId,
    };
    for (const end of [r.fromPersonId, r.toPersonId]) {
      const list = adj.get(end) ?? [];
      list.push(edge);
      adj.set(end, list);
    }
  }
  return adj;
}

const otherEnd = (e: Edge, id: string) => (e.a === id ? e.b : e.a);

async function names(ids: string[]) {
  const rows = await prisma.person.findMany({
    where: { id: { in: ids } },
    select: { id: true, displayName: true },
  });
  return new Map(rows.map((r) => [r.id, r.displayName]));
}

/** People within `hops` explicit relationships of `personId`, by distance. */
export async function getNetwork(personId: string, hops: 1 | 2 = 2) {
  const adj = await loadGraph();
  const dist = new Map<string, number>([[personId, 0]]);
  let frontier = [personId];
  for (let d = 1; d <= hops; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of adj.get(id) ?? []) {
        const o = otherEnd(e, id);
        if (!dist.has(o)) {
          dist.set(o, d);
          next.push(o);
        }
      }
    }
    frontier = next;
  }
  const ids = [...dist.keys()];
  const nameOf = await names(ids);
  const edgeSet = new Map<string, Edge>();
  for (const id of ids) {
    for (const e of adj.get(id) ?? []) {
      if (dist.has(e.a) && dist.has(e.b)) edgeSet.set(e.id, e);
    }
  }
  return {
    center: personId,
    people: ids.map((id) => ({
      id,
      displayName: nameOf.get(id) ?? "Unknown",
      hops: dist.get(id)!,
    })),
    edges: [...edgeSet.values()].map((e) => ({
      id: e.id,
      from: e.a,
      to: e.b,
      type: e.type,
      label: labelFor(e.type, e, e.a),
      source: e.source,
    })),
  };
}

export type PathStep = {
  from: { id: string; displayName: string };
  to: { id: string; displayName: string };
  relationship: {
    id: string;
    type: RelationshipKind;
    label: string;
    source: string | null;
  };
};

/**
 * Shortest introduction paths from `fromId` to `toId` over explicit edges
 * (any direction), up to `maxHops`. Shared organizations never complete a
 * path; they are returned apart as possible leads.
 */
export async function findIntroductionPaths(
  fromId: string,
  toId: string,
  maxHops = 4,
  maxPaths = 3,
) {
  if (fromId === toId) throw new PeopleInputError("Pick two different people");
  const adj = await loadGraph();
  // Breadth-first search that keeps every shortest predecessor.
  const dist = new Map<string, number>([[fromId, 0]]);
  const prev = new Map<string, { node: string; edge: Edge }[]>();
  let frontier = [fromId];
  for (let d = 1; d <= maxHops && frontier.length && !dist.has(toId); d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of adj.get(id) ?? []) {
        const o = otherEnd(e, id);
        if (dist.has(o) && dist.get(o)! < d) continue;
        if (!dist.has(o)) {
          dist.set(o, d);
          next.push(o);
        }
        const list = prev.get(o) ?? [];
        list.push({ node: id, edge: e });
        prev.set(o, list);
      }
    }
    frontier = next;
  }
  const paths: Edge[][] = [];
  const walk = (node: string, acc: Edge[]) => {
    if (paths.length >= maxPaths) return;
    if (node === fromId) return paths.push([...acc].reverse());
    for (const p of prev.get(node) ?? []) walk(p.node, [...acc, p.edge]);
  };
  if (dist.has(toId)) walk(toId, []);

  const ids = [
    ...new Set([fromId, toId, ...paths.flat().flatMap((e) => [e.a, e.b])]),
  ];
  const nameOf = await names(ids);
  const ref = (id: string) => ({
    id,
    displayName: nameOf.get(id) ?? "Unknown",
  });
  const steps = paths.map((path) => {
    let at = fromId;
    return path.map((e): PathStep => {
      const next = otherEnd(e, at);
      const step = {
        from: ref(at),
        to: ref(next),
        relationship: {
          id: e.id,
          type: e.type,
          label: labelFor(e.type, e, at),
          source: e.source,
        },
      };
      at = next;
      return step;
    });
  });
  return {
    from: ref(fromId),
    to: ref(toId),
    paths: steps,
    leads: await possibleLeads(fromId, toId),
  };
}

/** Organizations the target shares with the start or with its direct connections. */
async function possibleLeads(fromId: string, toId: string) {
  const adj = await loadGraph();
  const near = [
    fromId,
    ...(adj.get(fromId) ?? []).map((e) => otherEnd(e, fromId)),
  ].filter((id) => id !== toId);
  const target = await prisma.personAffiliation.findMany({
    where: { personId: toId },
    select: { organizationId: true, organization: { select: { name: true } } },
  });
  if (!target.length) return [];
  const shared = await prisma.personAffiliation.findMany({
    where: {
      personId: { in: near },
      organizationId: { in: target.map((t) => t.organizationId) },
    },
    include: {
      person: { select: { id: true, displayName: true } },
      organization: { select: { id: true, name: true } },
    },
  });
  return shared.map((s) => ({
    person: s.person,
    organization: s.organization,
    note: `${s.person.displayName} and the target share ${s.organization.name}. This is a lead, not a known connection.`,
  }));
}

/** Marks one profile as "me"; only one profile holds it. */
export async function setSelf(personId: string | null) {
  await prisma.$transaction([
    prisma.person.updateMany({
      where: { isSelf: true },
      data: { isSelf: false },
    }),
    ...(personId
      ? [
          prisma.person.update({
            where: { id: personId },
            data: { isSelf: true },
          }),
        ]
      : []),
  ]);
}

export async function getSelf() {
  return prisma.person.findFirst({
    where: { isSelf: true },
    select: { id: true, displayName: true },
  });
}
