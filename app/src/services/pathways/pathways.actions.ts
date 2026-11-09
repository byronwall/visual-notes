import { z } from "zod";
import { applyOps, type GraphOps } from "~/lib/pathways/graph-ops";
import type { PathwayContext } from "~/lib/pathways/types";
import { runPathwayAgent, runPathwayResearch } from "~/server/pathways/agent";
import type { PathwayAgentAction } from "~/server/pathways/agent-prompts";
import * as store from "~/server/pathways/pathway-store";

// Plain server functions: the map page calls them and swaps in the record
// each one returns, so the view never waits on a refetch. Each write is one
// revision, so Undo steps back through them.

const id = z.string().min(1).max(64);

export async function createPathwayFn(input: { title: string; notes?: string; sourceTaskId?: string; sourceDocId?: string }) {
  "use server";
  const p = z
    .object({
      title: z.string().min(1).max(300),
      notes: z.string().max(8000).optional(),
      sourceTaskId: id.optional(),
      sourceDocId: id.optional(),
    })
    .parse(input);
  return store.createPathway(p);
}

/** One batch of card and edge edits made by the person. */
export async function editPathway(input: { id: string; ops: GraphOps }) {
  "use server";
  const { record } = await store.writePathway(id.parse(input.id), "you", (d) => {
    d.graph = applyOps(d.graph, input.ops, "me").graph;
  });
  return record;
}

export async function setPathwayContext(input: { id: string; context: PathwayContext }) {
  "use server";
  const context = z
    .object({ notes: z.string().max(8000), qa: z.array(z.object({ q: z.string().max(500), a: z.string().max(4000) })).max(40) })
    .parse(input.context);
  const { record } = await store.writePathway(id.parse(input.id), "you", (d) => {
    d.context = context;
  });
  return record;
}

export async function undoPathwayFn(pathwayId: string) {
  "use server";
  return store.undoPathway(id.parse(pathwayId));
}

export async function archivePathwayFn(input: { id: string; archived: boolean }) {
  "use server";
  return store.setPathwayArchived(id.parse(input.id), input.archived);
}

const actions = ["options", "forward", "converge", "questions", "improve", "regenerate", "plan", "absorb"] as const;

export async function runPathwayAgentFn(input: { id: string; action: PathwayAgentAction; nodeId: string; hint: string }) {
  "use server";
  const p = z
    .object({ id, action: z.enum(actions), nodeId: z.string().max(64), hint: z.string().max(4000) })
    .parse(input);
  return runPathwayAgent(p.id, p.action, p.nodeId || "root", p.hint);
}

export async function runPathwayResearchFn(input: { id: string; nodeId: string }) {
  "use server";
  return runPathwayResearch(id.parse(input.id), id.parse(input.nodeId));
}
