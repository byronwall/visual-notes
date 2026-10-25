import { prisma } from "~/server/db";
import type { NoteFacts } from "./note-state";
import type { QueueItem } from "./queue";
import { openAssessmentWhere } from "./queue";
import {
  BETTER_TOGETHER,
  PLACEMENT_MIN,
  clusterPairs,
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

/** The Regroup bucket: combine clusters first, then notes to file. */
export async function regroupQueue(): Promise<QueueItem[]> {
  const open = await prisma.noteAssessment.findMany({
    where: openAssessmentWhere(),
    select: {
      docId: true,
      facts: true,
      model: true,
      placement: true,
      doc: { select: { title: true, path: true, collectionId: true } },
    },
  });
  const byId = new Map(open.map((row) => [row.docId, row]));
  const edges = await prisma.notePairAssessment.findMany({
    where: {
      betterTogether: { gte: BETTER_TOGETHER },
      aId: { in: [...byId.keys()] },
      bId: { in: [...byId.keys()] },
    },
    select: {
      aId: true,
      bId: true,
      betterTogether: true,
      aCoversB: true,
      bCoversA: true,
      relation: true,
    },
  });
  const items: QueueItem[] = [];
  const clustered = new Set<string>();
  for (const cluster of clusterPairs(edges)) {
    const keeper = byId.get(cluster.keeper)!;
    const facts = keeper.facts as unknown as NoteFacts;
    const members = cluster.ids.map((id) => {
      const row = byId.get(id)!;
      clustered.add(id);
      return {
        docId: id,
        title: row.doc.title,
        path: row.doc.path,
        words: (row.facts as unknown as NoteFacts).words,
      };
    });
    const relations = edges
      .filter((e) => cluster.ids.includes(e.aId) && cluster.ids.includes(e.bId))
      .map((e) => e.relation.replace(/_/g, " "));
    items.push({
      docId: cluster.keeper,
      title: keeper.doc.title,
      path: keeper.doc.path,
      bucket: "regroup",
      confidence: cluster.score,
      source: facts.source,
      created: facts.created,
      words: members.reduce((sum, m) => sum + m.words, 0),
      model: keeper.model,
      signals: [
        {
          label: `Better together ${cluster.score.toFixed(2)}`,
          tone: "strong",
        },
        { label: `${members.length} related notes`, tone: "neutral" },
        ...(relations[0]
          ? [{ label: `Relation: ${relations[0]}`, tone: "neutral" as const }]
          : []),
      ],
      regroup: { kind: "combine", members, keeperId: cluster.keeper },
    });
  }
  for (const row of open) {
    const placement = row.placement as Placement | null;
    if (!placement || placement.p < PLACEMENT_MIN) continue;
    if (clustered.has(row.docId) || row.doc.path || row.doc.collectionId)
      continue;
    const facts = row.facts as unknown as NoteFacts;
    items.push({
      docId: row.docId,
      title: row.doc.title,
      path: null,
      bucket: "regroup",
      confidence: placement.p,
      source: facts.source,
      created: facts.created,
      words: facts.words,
      model: row.model,
      signals: [
        {
          label: `Belongs in ${placement.label} ${placement.p.toFixed(2)}`,
          tone: "strong",
        },
        { label: "Unfiled", tone: "neutral" },
      ],
      regroup: { kind: "move", placement },
    });
  }
  return items.sort((a, b) => b.confidence - a.confidence);
}
