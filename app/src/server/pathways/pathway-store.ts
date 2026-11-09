import { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import {
  emptyGraph,
  ROOT_ID,
  type PathwayContext,
  type PathwayGraph,
  type PathwayPlan,
} from "~/lib/pathways/types";

// Every write goes through writePathway: it saves the current state as a
// PathwayRevision, applies the edit to a fresh read, and syncs the title from
// the root card. Undo restores the newest revision.

const KEEP_REVISIONS = 100;

const select = {
  id: true,
  title: true,
  graph: true,
  context: true,
  plan: true,
  sourceTaskId: true,
  sourceDocId: true,
  exportListId: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PathwaySelect;

type Row = Prisma.PathwayGetPayload<{ select: typeof select }>;

export type PathwayRecord = Omit<Row, "graph" | "context" | "plan"> & {
  graph: PathwayGraph;
  context: PathwayContext | null;
  plan: PathwayPlan | null;
};

/** The parts of a pathway an edit may change. */
export type PathwayDraft = {
  graph: PathwayGraph;
  context: PathwayContext | null;
  plan: PathwayPlan | null;
  exportListId: string | null;
};

const toRecord = (row: Row): PathwayRecord => ({
  ...row,
  graph: row.graph as unknown as PathwayGraph,
  context: (row.context as unknown as PathwayContext | null) ?? null,
  plan: (row.plan as unknown as PathwayPlan | null) ?? null,
});

const json = (v: unknown) =>
  v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue);
const graphJson = (g: PathwayGraph) => g as unknown as Prisma.InputJsonValue;

/**
 * Holds the row until the transaction ends, so two writes at once (the page,
 * the agent, MCP) run one after the other instead of the later one dropping
 * the earlier one's edit.
 */
const lockPathway = (tx: Prisma.TransactionClient, id: string) =>
  tx.$executeRaw`SELECT 1 FROM "Pathway" WHERE "id" = ${id} FOR UPDATE`;

export async function getPathway(id: string) {
  const row = await prisma.pathway.findUnique({ where: { id }, select });
  return row ? toRecord(row) : null;
}

export type PathwaySummary = {
  id: string;
  title: string;
  updatedAt: Date;
  cards: number;
  openTasks: number;
  archived: boolean;
};

export async function listPathways(
  opts: { archived?: boolean } = {},
): Promise<PathwaySummary[]> {
  const rows = await prisma.pathway.findMany({
    where: opts.archived ? {} : { archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select,
  });
  return rows.map((row) => {
    const r = toRecord(row);
    return {
      id: r.id,
      title: r.title,
      updatedAt: r.updatedAt,
      cards: r.graph.nodes.length,
      openTasks: r.plan?.tasks.filter((t) => t.status === "todo").length ?? 0,
      archived: !!r.archivedAt,
    };
  });
}

export async function createPathway(input: {
  title: string;
  notes?: string;
  sourceTaskId?: string | null;
  sourceDocId?: string | null;
  /** A whole map, for imports. The root card's title wins over `title`. */
  graph?: PathwayGraph;
  context?: PathwayContext | null;
  plan?: PathwayPlan | null;
}) {
  const graph =
    input.graph ?? emptyGraph(input.title.trim() || "Untitled decision");
  const root = graph.nodes.find((n) => n.id === ROOT_ID);
  if (!root)
    throw new Error('A pathway graph needs a root card with id "root"');
  const context =
    input.context ??
    (input.notes?.trim() ? { notes: input.notes.trim(), qa: [] } : null);
  const row = await prisma.pathway.create({
    data: {
      title: root.title,
      graph: graphJson(graph),
      context: json(context),
      plan: json(input.plan ?? null),
      sourceTaskId: input.sourceTaskId ?? null,
      sourceDocId: input.sourceDocId ?? null,
    },
    select,
  });
  console.info("[pathways] created %s", row.id);
  return toRecord(row);
}

/**
 * Applies `edit` to a fresh copy of the pathway, after saving the current
 * state as a revision. `label` says who changed it ("you", "agent: plan", ...).
 */
export async function writePathway<T = void>(
  id: string,
  label: string,
  edit: (draft: PathwayDraft) => T,
): Promise<{ record: PathwayRecord; result: T }> {
  return prisma.$transaction(async (tx) => {
    await lockPathway(tx, id);
    const row = await tx.pathway.findUnique({ where: { id }, select });
    if (!row) throw new Error(`Pathway ${id} not found`);
    const current = toRecord(row);
    const draft: PathwayDraft = structuredClone({
      graph: current.graph,
      context: current.context,
      plan: current.plan,
      exportListId: current.exportListId,
    });
    const result = edit(draft);
    await tx.pathwayRevision.create({
      data: {
        pathwayId: id,
        label,
        snapshot: {
          graph: current.graph,
          context: current.context,
          plan: current.plan,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    const title =
      draft.graph.nodes.find((n) => n.id === ROOT_ID)?.title ?? current.title;
    const updated = await tx.pathway.update({
      where: { id },
      data: {
        title,
        graph: graphJson(draft.graph),
        context: json(draft.context),
        plan: json(draft.plan),
        exportListId: draft.exportListId,
      },
      select,
    });
    const old = await tx.pathwayRevision.findMany({
      where: { pathwayId: id },
      orderBy: { createdAt: "desc" },
      skip: KEEP_REVISIONS,
      select: { id: true },
    });
    if (old.length)
      await tx.pathwayRevision.deleteMany({
        where: { id: { in: old.map((r) => r.id) } },
      });
    return { record: toRecord(updated), result };
  });
}

/** Restores the newest revision. Returns null when there is nothing to undo. */
export async function undoPathway(id: string) {
  return prisma.$transaction(async (tx) => {
    await lockPathway(tx, id);
    const rev = await tx.pathwayRevision.findFirst({
      where: { pathwayId: id },
      orderBy: { createdAt: "desc" },
    });
    if (!rev) return null;
    const snap = rev.snapshot as unknown as Pick<
      PathwayDraft,
      "graph" | "context" | "plan"
    >;
    const title = snap.graph.nodes.find((n) => n.id === ROOT_ID)?.title;
    const row = await tx.pathway.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        graph: graphJson(snap.graph),
        context: json(snap.context),
        plan: json(snap.plan),
      },
      select,
    });
    await tx.pathwayRevision.delete({ where: { id: rev.id } });
    return { record: toRecord(row), label: rev.label };
  });
}

export async function setPathwayArchived(id: string, archived: boolean) {
  const row = await prisma.pathway.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
    select,
  });
  return toRecord(row);
}
