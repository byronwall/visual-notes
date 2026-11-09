import { z } from "zod";
import { applyOps, newNodeId, type GraphOps } from "~/lib/pathways/graph-ops";
import type { PathwayContext } from "~/lib/pathways/types";
import { runPathwayAgent, runPathwayResearch } from "~/server/pathways/agent";
import type { PathwayAgentAction } from "~/server/pathways/agent-prompts";
import * as store from "~/server/pathways/pathway-store";
import {
  exportPlanTasks,
  updatePlanTask,
  withLinkedStatus,
} from "~/server/pathways/pathway-tasks";

// Plain server functions: the map page calls them and swaps in the record
// each one returns, so the view never waits on a refetch. Each write is one
// revision, so Undo steps back through them.

const id = z.string().min(1).max(64);

// The edits the page sends. Parsed here, so a client can't write any JSON
// (a non-string title, an unknown status, a huge or odd feedback object)
// into the stored graph.
const kind = z.enum(["option", "step", "outcome"]);
const edge = z.object({ from: id, to: id });
const opsInput = z.object({
  nodes: z
    .array(z.object({ ref: id, kind, title: z.string().max(300) }))
    .max(40)
    .optional(),
  edges: z.array(edge).max(80).optional(),
  removeEdges: z.array(edge).max(80).optional(),
  update: z
    .array(
      z.object({
        id,
        title: z.string().max(300).optional(),
        note: z.string().max(8000).optional(),
        kind: kind.optional(),
        status: z.enum(["open", "chosen", "dropped"]).optional(),
        weight: z.enum(["key", "noise"]).nullish(),
        feedback: z
          .object({
            vote: z.enum(["like", "no", "more"]).optional(),
            comment: z.string().max(4000),
          })
          .nullish(),
        research: z
          .object({
            question: z.string().max(500),
            status: z.enum(["suggested", "queued", "done"]),
            findings: z.string().max(8000).optional(),
            sources: z
              .array(
                z.object({
                  title: z.string().max(300),
                  url: z.string().regex(/^https?:\/\//i).max(2000),
                }),
              )
              .max(20)
              .optional(),
            by: z.string().max(200).optional(),
          })
          .nullish(),
      }),
    )
    .max(40)
    .optional(),
  remove: z.array(id).max(40).optional(),
}) satisfies z.ZodType<GraphOps>;

export async function createPathwayFn(input: {
  title: string;
  notes?: string;
  sourceTaskId?: string;
  sourceDocId?: string;
}) {
  "use server";
  const p = z
    .object({
      title: z.string().min(1).max(300),
      notes: z.string().max(8000).optional(),
      sourceTaskId: id.optional(),
      sourceDocId: id.optional(),
    })
    .parse(input);
  return withLinkedStatus(await store.createPathway(p));
}

/**
 * One batch of card and edge edits made by the person. `newIds` are ids the
 * page already gave new cards, so its optimistic copy matches the server's.
 */
export async function editPathway(input: {
  id: string;
  ops: GraphOps;
  newIds?: string[];
  coalesce?: string;
}) {
  "use server";
  const ids = z
    .array(z.string().regex(/^[a-z0-9]{4,12}$/))
    .max(40)
    .parse(input.newIds ?? []);
  const coalesce = z.string().max(80).optional().parse(input.coalesce);
  const ops = opsInput.parse(input.ops);
  const { record } = await store.writePathway(
    id.parse(input.id),
    "you",
    (d) => {
      d.graph = applyOps(
        d.graph,
        ops,
        "me",
        () => ids.shift() ?? newNodeId(),
      ).graph;
    },
    { coalesce },
  );
  return withLinkedStatus(record);
}

export async function setPathwayContext(input: {
  id: string;
  context: PathwayContext;
  coalesce?: string;
}) {
  "use server";
  const context = z
    .object({
      notes: z.string().max(8000),
      qa: z
        .array(z.object({ q: z.string().max(500), a: z.string().max(4000) }))
        .max(40),
    })
    .parse(input.context);
  const coalesce = z.string().max(80).optional().parse(input.coalesce);
  const { record } = await store.writePathway(
    id.parse(input.id),
    "you",
    (d) => {
      d.context = context;
    },
    { coalesce },
  );
  return withLinkedStatus(record);
}

export async function undoPathwayFn(pathwayId: string) {
  "use server";
  const r = await store.undoPathway(id.parse(pathwayId));
  return r ? withLinkedStatus(r.record) : null;
}

export async function archivePathwayFn(input: {
  id: string;
  archived: boolean;
}) {
  "use server";
  return store.setPathwayArchived(
    id.parse(input.id),
    z.boolean().parse(input.archived),
  );
}

const actions = [
  "options",
  "forward",
  "converge",
  "questions",
  "improve",
  "regenerate",
  "plan",
  "absorb",
] as const;

export async function runPathwayAgentFn(input: {
  id: string;
  action: PathwayAgentAction;
  nodeId: string;
  hint: string;
}) {
  "use server";
  const p = z
    .object({
      id,
      action: z.enum(actions),
      nodeId: z.string().max(64),
      hint: z.string().max(4000),
    })
    .parse(input);
  const run = await runPathwayAgent(p.id, p.action, p.nodeId || "root", p.hint);
  return { ...run, record: await withLinkedStatus(run.record) };
}

export async function runPathwayResearchFn(input: {
  id: string;
  nodeId: string;
}) {
  "use server";
  return withLinkedStatus(
    await runPathwayResearch(id.parse(input.id), id.parse(input.nodeId)),
  );
}

/** Check off, skip, or write what happened on one Next steps entry. */
export async function updatePlanTaskFn(input: {
  id: string;
  taskId: string;
  status?: "todo" | "done" | "skipped";
  result?: string;
  coalesce?: string;
}) {
  "use server";
  const p = z
    .object({
      id,
      taskId: id,
      status: z.enum(["todo", "done", "skipped"]).optional(),
      result: z.string().max(4000).optional(),
      coalesce: z.string().max(80).optional(),
    })
    .parse(input);
  return updatePlanTask(
    p.id,
    p.taskId,
    { status: p.status, result: p.result },
    p.coalesce,
  );
}

/** Turns chosen Next steps into real tasks in one list. */
export async function exportPlanTasksFn(input: {
  id: string;
  planTaskIds: string[];
  listId: string | null;
}) {
  "use server";
  const p = z
    .object({
      id,
      planTaskIds: z.array(id).min(1).max(20),
      listId: id.nullable(),
    })
    .parse(input);
  return exportPlanTasks(p.id, p.planTaskIds, p.listId);
}
