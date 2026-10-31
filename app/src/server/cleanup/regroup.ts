import { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import { noteMarkdown } from "~/server/notes/note-store";
import type { Answers, Decider } from "./decide";
import { titleWords } from "./heuristic";
import { cleanBody } from "./note-state";
import {
  OWNER_PROFILE,
  PAIR_QUESTIONS,
  placementQuestion,
  type PlacementTarget,
} from "./questions";

/**
 * Regroup finds two kinds of suggestion: related notes that read better as
 * one (pairs from embedding neighbors, confirmed by the decision model, then
 * clustered), and unfiled notes that belong in an existing path or
 * collection (one choice question).
 */

const LOG_PREFIX = "[cleanup-regroup]";
const PAIR_BODY_CAP = 3_000;
const NEIGHBORS = 5;
const MIN_SIMILARITY = 0.8;
export const BETTER_TOGETHER = 0.6;
export const PLACEMENT_MIN = 0.5;
const MAX_CLUSTER = 6;

export type Placement = {
  kind: "path" | "collection";
  value: string;
  label: string;
  p: number;
};

/** Paths with a few notes and live collections, as places to file a note. */
export async function placementTargets(): Promise<PlacementTarget[]> {
  const [paths, collections] = await Promise.all([
    prisma.doc.groupBy({
      by: ["path"],
      where: { path: { not: null }, archivedAt: null },
      _count: { _all: true },
    }),
    prisma.collection.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      take: 15,
    }),
  ]);
  const pathTargets = paths
    .filter((g) => g.path && g._count._all >= 2)
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 20)
    .map((g) => ({
      key: `path:${g.path}`,
      kind: "path" as const,
      value: g.path!,
      label: g.path!,
      description: `Notes filed under ${g.path} (${g._count._all} notes).`,
    }));
  const collectionTargets = collections.map((c) => ({
    key: `collection:${c.id}`,
    kind: "collection" as const,
    value: c.id,
    label: c.name,
    description: `The "${c.name}" collection.`,
  }));
  return [...pathTargets, ...collectionTargets];
}

export function readPlacement(
  answers: Answers,
  targets: PlacementTarget[],
): Placement | null {
  const a = answers.placement;
  if (!a || !("choice" in a) || a.choice === "other") return null;
  const target = targets.find((t) => t.key === a.choice);
  if (!target) return null;
  return {
    kind: target.kind,
    value: target.value,
    label: target.label,
    p: a.probs[a.choice] ?? 0,
  };
}

/** For an unfiled note: which existing path or collection it belongs in. */
export async function assessPlacement(
  docId: string,
  note: { title: string; body: string },
  decide: Decider,
): Promise<void> {
  const targets = await placementTargets();
  if (!targets.length) return;
  const result = await decide({
    owner: OWNER_PROFILE,
    state: { note: { title: note.title, body: note.body.slice(0, 6_000) } },
    questions: [placementQuestion(targets)],
    noteId: docId,
    kind: "placement",
  });
  const placement = readPlacement(result.answers, targets);
  await prisma.noteAssessment.update({
    where: { docId },
    data: {
      placement: (placement ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

/** Embedding neighbors when vectors exist, else same-path title matches. */
export async function pairCandidates(doc: {
  id: string;
  title: string;
  path: string | null;
}): Promise<{ id: string; similarity: number | null }[]> {
  const { docNeighbors } = await import("~/server/mcp/semantic");
  const neighbors = await docNeighbors(doc.id, NEIGHBORS, MIN_SIMILARITY).catch(
    () => [],
  );
  if (neighbors.length) {
    return neighbors.map((n) => ({ id: n.id, similarity: n.score }));
  }
  if (!doc.path) return [];
  const words = titleWords(doc.title);
  const siblings = await prisma.doc.findMany({
    where: {
      id: { not: doc.id },
      path: doc.path,
      archivedAt: null,
      collectionId: null,
    },
    select: { id: true, title: true },
    take: 200,
  });
  return siblings
    .filter((s) => [...titleWords(s.title)].some((w) => words.has(w)))
    .slice(0, NEIGHBORS)
    .map((s) => ({ id: s.id, similarity: null }));
}

const pairSelect = {
  id: true,
  title: true,
  path: true,
  contentVersion: true,
  markdown: true,
  html: true,
  content: true,
  archivedAt: true,
  collectionId: true,
} as const;

const pairNote = (
  doc: { title: string; path: string | null } & Parameters<
    typeof noteMarkdown
  >[0],
) => ({
  title: doc.title,
  path: doc.path,
  body: cleanBody(noteMarkdown(doc)).slice(0, PAIR_BODY_CAP),
});

const p = (answers: Answers, id: string) => {
  const a = answers[id];
  return a && "p" in a ? a.p : 0;
};

/** Asks the pair questions for one note and each of its candidates. */
export async function assessPairsFor(
  docId: string,
  decide: Decider,
): Promise<number> {
  const doc = await prisma.doc.findUnique({
    where: { id: docId },
    select: pairSelect,
  });
  if (!doc || doc.archivedAt || doc.collectionId) return 0;
  let asked = 0;
  for (const candidate of await pairCandidates(doc)) {
    const other = await prisma.doc.findUnique({
      where: { id: candidate.id },
      select: pairSelect,
    });
    if (!other || other.archivedAt || other.collectionId) continue;
    const [a, b] = doc.id < other.id ? [doc, other] : [other, doc];
    const existing = await prisma.notePairAssessment.findUnique({
      where: { aId_bId: { aId: a.id, bId: b.id } },
      select: { aVersion: true, bVersion: true },
    });
    if (
      existing?.aVersion === a.contentVersion &&
      existing.bVersion === b.contentVersion
    ) {
      continue;
    }
    const result = await decide({
      owner: OWNER_PROFILE,
      state: { a: pairNote(a), b: pairNote(b) },
      questions: PAIR_QUESTIONS,
      noteId: a.id,
      kind: "pair",
    });
    const relation = result.answers.relation;
    const data = {
      aVersion: a.contentVersion,
      bVersion: b.contentVersion,
      model: result.model,
      similarity: candidate.similarity,
      answers: result.answers as unknown as Prisma.InputJsonValue,
      relation: relation && "label" in relation ? relation.label : "",
      betterTogether: p(result.answers, "better_together"),
      aCoversB: p(result.answers, "a_covers_b"),
      bCoversA: p(result.answers, "b_covers_a"),
    };
    await prisma.notePairAssessment.upsert({
      where: { aId_bId: { aId: a.id, bId: b.id } },
      create: { aId: a.id, bId: b.id, ...data },
      update: data,
    });
    asked += 1;
  }
  await prisma.noteAssessment.updateMany({
    where: { docId },
    data: { pairsVersion: doc.contentVersion },
  });
  return asked;
}

/** Notes whose pairs were never checked, or changed since they were. */
const STALE_PAIRS = Prisma.sql`
    FROM "NoteAssessment" a
    JOIN "Doc" d ON d.id = a."docId"
    WHERE d."archivedAt" IS NULL
      AND d."collectionId" IS NULL
      AND (a."pairsVersion" IS NULL OR a."pairsVersion" <> d."contentVersion")`;

export async function countStalePairs(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n ${STALE_PAIRS}`;
  return rows[0]?.n ?? 0;
}

export async function assessStalePairs(limit: number, decide: Decider) {
  const rows = await prisma.$queryRaw<Array<{ docId: string }>>`
    SELECT a."docId" ${STALE_PAIRS}
    ORDER BY d."updatedAt" DESC
    LIMIT ${limit}`;
  let asked = 0;
  for (const row of rows) {
    try {
      asked += await assessPairsFor(row.docId, decide);
    } catch (error) {
      console.warn(`${LOG_PREFIX} pair pass failed doc=${row.docId}`, error);
    }
  }
  if (rows.length) {
    console.info(
      `${LOG_PREFIX} checked ${rows.length} notes, asked ${asked} pairs`,
    );
  }
  return { checked: rows.length, asked };
}

export type PairEdge = {
  aId: string;
  bId: string;
  betterTogether: number;
  aCoversB: number;
  bCoversA: number;
};

/**
 * Union-find over pairs that read better together. Returns clusters of
 * 2..MAX_CLUSTER notes with the mean pair score; bigger components are cut
 * down to their strongest edges.
 */
export function clusterPairs(edges: PairEdge[]): Array<{
  ids: string[];
  score: number;
  /** Member that covers the most others: the default note to keep. */
  keeper: string;
}> {
  const strong = edges
    .filter((e) => e.betterTogether >= BETTER_TOGETHER)
    .sort((x, y) => y.betterTogether - x.betterTogether);
  const parent = new Map<string, string>();
  const size = new Map<string, number>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  const ensure = (id: string) => {
    if (!parent.has(id)) {
      parent.set(id, id);
      size.set(id, 1);
    }
  };
  for (const e of strong) {
    ensure(e.aId);
    ensure(e.bId);
    const ra = find(e.aId);
    const rb = find(e.bId);
    if (ra === rb) continue;
    if ((size.get(ra) ?? 1) + (size.get(rb) ?? 1) > MAX_CLUSTER) continue;
    parent.set(rb, ra);
    size.set(ra, (size.get(ra) ?? 1) + (size.get(rb) ?? 1));
  }
  const groups = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    const group = groups.get(root);
    if (group) group.push(id);
    else groups.set(root, [id]);
  }
  // Production has thousands of clusters: sort each edge into its cluster
  // once instead of rescanning every edge per cluster.
  const within = new Map<string, PairEdge[]>();
  for (const e of edges) {
    if (!parent.has(e.aId) || !parent.has(e.bId)) continue;
    const root = find(e.aId);
    if (root !== find(e.bId)) continue;
    const list = within.get(root);
    if (list) list.push(e);
    else within.set(root, [e]);
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .map(([root, ids]) => {
      const members = within.get(root) ?? [];
      const inside = members.filter((e) => e.betterTogether >= BETTER_TOGETHER);
      const covers = new Map<string, number>();
      for (const e of members) {
        covers.set(e.aId, (covers.get(e.aId) ?? 0) + e.aCoversB);
        covers.set(e.bId, (covers.get(e.bId) ?? 0) + e.bCoversA);
      }
      const keeper = [...ids].sort(
        (x, y) =>
          (covers.get(y) ?? 0) - (covers.get(x) ?? 0) || x.localeCompare(y),
      )[0];
      const score =
        inside.reduce((sum, e) => sum + e.betterTogether, 0) /
        Math.max(1, inside.length);
      return { ids: [...ids].sort(), score, keeper };
    })
    .sort((x, y) => y.score - x.score);
}
