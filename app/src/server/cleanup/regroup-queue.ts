import { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import type { NoteFacts } from "./note-state";
import type { QueueItem, QueueRow } from "./queue";
import { QUEUE_LIMIT, openAssessmentWhere } from "./queue";
import {
  BETTER_TOGETHER,
  PLACEMENT_MIN,
  clusterPairs,
  type PairEdge,
  type Placement,
} from "./regroup";

export type RegroupMember = {
  docId: string;
  title: string;
  path: string | null;
  words: number;
};

export type RegroupDetail =
  | { kind: "combine"; members: RegroupMember[]; keeperId: string }
  | { kind: "move"; placement: Placement };

/**
 * The Regroup bucket's shape without any note data: clusters from the strong
 * pairs, and unfiled notes with a confident placement. Reads only those rows,
 * so the rail's count doesn't pay for every open assessment.
 */
async function loadRegroupPlan() {
  const [open, strong] = await Promise.all([
    prisma.noteAssessment.findMany({
      where: openAssessmentWhere(),
      select: { docId: true },
    }),
    // Raw: tens of thousands of rows, and Prisma's mapping is ~4x slower here.
    prisma.$queryRaw<Array<PairEdge & { relation: string }>>`
      SELECT "aId", "bId", "betterTogether", "aCoversB", "bCoversA", relation
      FROM "NotePairAssessment"
      WHERE "betterTogether" >= ${BETTER_TOGETHER}`,
  ]);
  const openIds = new Set(open.map((row) => row.docId));
  const edges = strong.filter((e) => openIds.has(e.aId) && openIds.has(e.bId));
  const clusters = clusterPairs(edges);
  const clustered = new Set(clusters.flatMap((c) => c.ids));
  const unfiled = await prisma.noteAssessment.findMany({
    where: {
      ...openAssessmentWhere(),
      placement: { not: Prisma.DbNull },
      doc: { archivedAt: null, path: null, collectionId: null },
    },
    select: { docId: true, placement: true },
  });
  const moves = unfiled.flatMap((row) => {
    const placement = row.placement as Placement;
    return placement.p >= PLACEMENT_MIN && !clustered.has(row.docId)
      ? [{ docId: row.docId, placement }]
      : [];
  });
  return { edges, clusters, moves };
}

let planInFlight: ReturnType<typeof loadRegroupPlan> | null = null;

/** The rail and the queue load together: they share one read. */
function regroupPlan() {
  planInFlight ??= loadRegroupPlan().finally(() => {
    planInFlight = null;
  });
  return planInFlight;
}

export async function regroupCount(): Promise<number> {
  const { clusters, moves } = await regroupPlan();
  return clusters.length + moves.length;
}

/** The Regroup bucket's rows, strongest first. */
export async function regroupQueue(limit = QUEUE_LIMIT): Promise<QueueRow[]> {
  const { clusters, moves } = await regroupPlan();
  const entries = [
    ...clusters.map((c) => ({ kind: "combine" as const, ...c })),
    ...moves.map((m) => ({ kind: "move" as const, ...m })),
  ]
    .map((entry) => ({
      entry,
      docId: entry.kind === "combine" ? entry.keeper : entry.docId,
      confidence: entry.kind === "combine" ? entry.score : entry.placement.p,
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
  const docs = await prisma.doc.findMany({
    where: { id: { in: entries.map((e) => e.docId) } },
    select: { id: true, title: true, path: true },
  });
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  return entries.flatMap(({ entry, docId, confidence }) => {
    const doc = byId.get(docId);
    if (!doc) return [];
    const meta =
      entry.kind === "combine"
        ? [`Combine ${entry.ids.length} notes`, doc.path]
            .filter(Boolean)
            .join(" · ")
        : `Unfiled · move to ${entry.placement.label}`;
    return [
      {
        docId,
        title: doc.title,
        path: doc.path,
        bucket: "regroup",
        confidence,
        meta,
      },
    ];
  });
}

/** One Regroup suggestion in full, with its members' titles and sizes. */
export async function regroupItem(docId: string): Promise<QueueItem | null> {
  const { edges, clusters, moves } = await regroupPlan();
  const cluster = clusters.find((c) => c.keeper === docId);
  const move = moves.find((m) => m.docId === docId);
  if (!cluster && !move) return null;
  const rows = await prisma.noteAssessment.findMany({
    where: { docId: { in: cluster?.ids ?? [docId] } },
    select: {
      docId: true,
      facts: true,
      model: true,
      doc: { select: { title: true, path: true } },
    },
  });
  const byId = new Map(rows.map((row) => [row.docId, row]));
  const self = byId.get(docId);
  if (!self) return null;
  const facts = self.facts as unknown as NoteFacts;
  const base = {
    docId,
    title: self.doc.title,
    path: self.doc.path,
    bucket: "regroup",
    source: facts.source,
    created: facts.created,
    model: self.model,
  };
  if (move) {
    return {
      ...base,
      path: null,
      confidence: move.placement.p,
      words: facts.words,
      signals: [
        {
          label: `Belongs in ${move.placement.label} ${move.placement.p.toFixed(2)}`,
          tone: "strong",
        },
        { label: "Unfiled", tone: "neutral" },
      ],
      regroup: { kind: "move", placement: move.placement },
    };
  }
  const { ids, score, keeper } = cluster!;
  const members = ids.flatMap((id) => {
    const row = byId.get(id);
    if (!row) return [];
    const { words } = row.facts as unknown as NoteFacts;
    return [{ docId: id, title: row.doc.title, path: row.doc.path, words }];
  });
  const relation = edges
    .find((e) => ids.includes(e.aId) && ids.includes(e.bId))
    ?.relation.replace(/_/g, " ");
  return {
    ...base,
    confidence: score,
    words: members.reduce((sum, m) => sum + m.words, 0),
    signals: [
      { label: `Better together ${score.toFixed(2)}`, tone: "strong" },
      { label: `${members.length} related notes`, tone: "neutral" },
      ...(relation
        ? [{ label: `Relation: ${relation}`, tone: "neutral" as const }]
        : []),
    ],
    regroup: { kind: "combine", members, keeperId: keeper },
  };
}
