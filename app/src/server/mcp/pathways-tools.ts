import { z } from "zod";
import { applyOps, type GraphOps } from "~/lib/pathways/graph-ops";
import { meetingPoints, replacePlan } from "~/lib/pathways/plan";
import {
  ROOT_ID,
  type PathwayContext,
  type PathwayGraph,
} from "~/lib/pathways/types";
import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import * as store from "~/server/pathways/pathway-store";
import {
  mirrorStatus,
  undoWithTasks,
  withLinkedStatus,
} from "~/server/pathways/pathway-tasks";
import {
  agentContext,
  appLink,
  ConnectorError,
  type ConnectorContext,
} from "./shared";
import type { ToolRegistrar } from "./tool-registry";

// Pathways over the connector: decision maps of options, the steps they lead
// to, and outcomes, plus the person's goals, reactions, and Next steps. The
// chat agent reads a map with pathways_get and writes through the same
// edit batches and store the page uses, so every write can be undone.

export const PATHWAY_INSTRUCTIONS =
  "Pathways are decision maps: a root question, options (choices), steps (what happens after a choice), and outcomes (where you end up), with edges pointing forward in time. The point is to show where different choices lead to the same place: link to an existing card instead of adding a near-duplicate. pathways_get returns the map with the person's goals, reactions (like / not for me / want better), notes, weights (important / noise), research, and Next steps; respect all of them, do not expand noise or dropped cards, and do not suggest done cards again (they are finished and hidden from the map). pathways_edit changes cards and edges in one batch; pathways_set_plan writes the Next steps list (3-7 concrete actions, cheapest information first); pathways_report_research answers a card's queued research question. Every write is undoable with pathways_undo. Export to real tasks is the person's choice, made on the page.";

const kindArg = z.enum(["option", "step", "outcome"]);
const statusArg = z.enum(["open", "chosen", "done", "dropped"]);
// Source links render as <a href> on the page, so only web addresses.
const webUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "Use an http(s) address");
const idArg = z
  .string()
  .min(1)
  .describe(
    "A card id from pathways_get, or a ref of a card added in this same call",
  );

const opsArg = z.object({
  nodes: z
    .array(
      z.object({
        ref: z
          .string()
          .min(1)
          .describe('Your name for the new card in this call, e.g. "n1"'),
        kind: kindArg,
        title: z.string().min(1).max(200).describe("Under 12 words, concrete"),
        note: z
          .string()
          .max(2000)
          .optional()
          .describe("One sentence: why, cost, or tradeoff"),
        missed: z
          .boolean()
          .optional()
          .describe("An option the person has probably not considered"),
        research: z
          .string()
          .max(500)
          .optional()
          .describe("A question a web search could answer before acting"),
      }),
    )
    .max(40)
    .optional(),
  edges: z
    .array(z.object({ from: idArg, to: idArg }))
    .max(80)
    .optional(),
  removeEdges: z
    .array(z.object({ from: idArg, to: idArg }))
    .max(80)
    .optional(),
  merges: z
    .array(
      z.object({
        keep: idArg,
        drop: idArg,
        title: z.string().max(200).nullish(),
      }),
    )
    .max(20)
    .optional()
    .describe("Fold a duplicate into another card; its edges move over"),
  drops: z
    .array(idArg)
    .max(40)
    .optional()
    .describe("Mark cards dropped (kept, faded)"),
  chosen: z
    .array(idArg)
    .max(40)
    .optional()
    .describe("Mark cards the person committed to; they stay on the map"),
  done: z
    .array(idArg)
    .max(40)
    .optional()
    .describe(
      "Mark cards the person finished. The map hides them and joins their parents to their children. Do not suggest them again",
    ),
  appendNotes: z
    .array(z.object({ id: idArg, text: z.string().min(1).max(1000) }))
    .max(40)
    .optional()
    .describe(
      'Add a line to a card\'s note, e.g. "Nov 9: Matt replied with three names"',
    ),
  update: z
    .array(
      z.object({
        id: idArg,
        title: z.string().max(200).optional(),
        note: z.string().max(4000).optional(),
        kind: kindArg.optional(),
        status: statusArg.optional(),
      }),
    )
    .max(40)
    .optional(),
  remove: z
    .array(idArg)
    .max(40)
    .optional()
    .describe(
      "Delete cards the agent added by mistake; prefer drops for real options",
    ),
});

const nodeView = (graph: PathwayGraph) =>
  graph.nodes.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    ...(n.note ? { note: n.note } : {}),
    status: n.status,
    by: n.by,
    ...(n.weight ? { weight: n.weight === "key" ? "important" : "noise" } : {}),
    ...(n.feedback?.vote
      ? {
          reaction: {
            like: "likes this",
            no: "does not want this",
            more: "wants better options here",
          }[n.feedback.vote],
        }
      : {}),
    ...(n.feedback?.comment.trim()
      ? { personNote: n.feedback.comment.trim() }
      : {}),
    ...(n.missed ? { newAngle: true } : {}),
    ...(n.research ? { research: n.research } : {}),
  }));

function mapView(ctx: ConnectorContext, p: store.PathwayRecord) {
  const titles = new Map(p.graph.nodes.map((n) => [n.id, n.title]));
  return {
    id: p.id,
    title: p.title,
    appUrl: appLink(ctx, `/pathways/${p.id}`),
    goals: p.context ?? { notes: "", qa: [] },
    cards: nodeView(p.graph),
    edges: p.graph.edges,
    pathsMeet: meetingPoints(p.graph).map((m) => ({
      ...m,
      title: titles.get(m.id),
    })),
    researchQueue: p.graph.nodes
      .filter((n) => n.research && n.research.status !== "done")
      .map((n) => ({
        nodeId: n.id,
        title: n.title,
        question: n.research!.question,
        status: n.research!.status,
      })),
    nextSteps: p.plan,
    sourceTaskId: p.sourceTaskId,
    sourceNoteId: p.sourceDocId,
    updatedAt: p.updatedAt.toISOString(),
  };
}

const titleOf = (graph: PathwayGraph, ids: string[]) =>
  ids.map((id) => ({
    id,
    title: graph.nodes.find((n) => n.id === id)?.title ?? id,
  }));

const graphImport = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(["root", "option", "step", "outcome"]),
        title: z.string().min(1),
        note: z.string().default(""),
        by: z.enum(["me", "agent"]).default("me"),
        status: statusArg.default("open"),
        missed: z.boolean().optional(),
        weight: z.enum(["key", "noise"]).optional(),
        feedback: z
          .object({
            vote: z.enum(["like", "no", "more"]).optional(),
            comment: z.string(),
          })
          .optional(),
        research: z
          .object({
            question: z.string(),
            status: z.enum(["suggested", "queued", "done"]),
            findings: z.string().optional(),
            sources: z
              .array(z.object({ title: z.string(), url: webUrl }))
              .optional(),
            by: z.string().optional(),
          })
          .optional(),
      }),
    )
    .min(1),
  edges: z.array(z.object({ from: z.string(), to: z.string() })),
});

const planImport = z.object({
  createdAt: z.string().default(() => new Date().toISOString()),
  summary: z.string().max(1000).default(""),
  tasks: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        title: z.string().min(1).max(200),
        why: z.string().max(500).default(""),
        doneWhen: z.string().max(300).default(""),
        minutes: z.number().min(1).max(1440).default(30),
        nodeIds: z.array(z.string()).default([]),
        status: z.enum(["todo", "done", "skipped"]).default("todo"),
        result: z.string().max(4000).default(""),
        absorbed: z.boolean().optional(),
      }),
    )
    .max(50),
});

export function registerPathwayTools(tools: ToolRegistrar): void {
  const { ctx } = tools;
  const log = (
    eventType: string,
    entityId: string,
    payload: Record<string, string | number | boolean | null | string[]>,
  ) =>
    logActionEvent({
      eventType,
      entityType: "pathway",
      entityId,
      payload,
      context: agentContext(ctx),
    });
  const label = (tool: string) => `mcp: ${tool}`;

  tools.read(
    "pathways_list",
    {
      title: "List pathways",
      description:
        "Decision maps, most recently changed first, with card and open Next steps counts.",
      input: {
        archived: z.boolean().optional().describe("Include archived maps"),
      },
    },
    async ({ archived }) => ({
      pathways: (await store.listPathways({ archived })).map((p) => ({
        ...p,
        updatedAt: p.updatedAt.toISOString(),
        appUrl: appLink(ctx, `/pathways/${p.id}`),
      })),
      appUrl: appLink(ctx, "/pathways"),
    }),
  );

  tools.read(
    "pathways_get",
    {
      title: "Get pathway",
      description:
        "One decision map: goals and Q&A, every card (with the person's reactions, notes, weights, and research), edges, where paths meet, the research queue, and Next steps.",
      input: { id: z.string().min(1) },
    },
    async ({ id }) => {
      const p = await store.getPathway(id);
      if (!p) throw new ConnectorError("not_found", `Pathway ${id} not found`);
      // Exported steps show their real task's status.
      return mapView(ctx, await withLinkedStatus(p));
    },
  );

  tools.write(
    "pathways_create",
    {
      title: "Create pathway",
      description:
        "Start a decision map from a question. Pass fromTaskId to start from a task (its text becomes the question unless you give one) or fromNoteId to tie it to a note you read. Then add options with pathways_edit. `import` copies a whole map (graph, goals, Next steps) as is.",
      input: {
        question: z
          .string()
          .max(300)
          .optional()
          .describe("The decision, as a question"),
        goals: z
          .string()
          .max(8000)
          .optional()
          .describe("What matters to the person, in their words"),
        fromTaskId: z.string().optional(),
        fromNoteId: z.string().optional(),
        import: z
          .object({
            graph: graphImport,
            goals: z
              .object({
                notes: z.string(),
                qa: z.array(z.object({ q: z.string(), a: z.string() })),
              })
              .optional(),
            nextSteps: planImport
              .optional()
              .describe("A plan object as pathways_get returns it"),
          })
          .optional(),
      },
    },
    async (args) => {
      const task = args.fromTaskId
        ? await prisma.taskItem.findUnique({
            where: { id: args.fromTaskId },
            select: { id: true, description: true },
          })
        : null;
      if (args.fromTaskId && !task)
        throw new ConnectorError(
          "not_found",
          `Task ${args.fromTaskId} not found`,
        );
      const note = args.fromNoteId
        ? await prisma.doc.findUnique({
            where: { id: args.fromNoteId },
            select: { id: true },
          })
        : null;
      if (args.fromNoteId && !note)
        throw new ConnectorError(
          "not_found",
          `Note ${args.fromNoteId} not found`,
        );
      const question = args.question?.trim() || task?.description;
      if (!question && !args.import)
        throw new ConnectorError(
          "invalid",
          "Give a question, a fromTaskId, or an import",
        );

      let graph: PathwayGraph | undefined;
      if (args.import) {
        graph = applyOps(args.import.graph as PathwayGraph, {}, "me").graph;
        if (!graph.nodes.some((n) => n.id === ROOT_ID))
          throw new ConnectorError(
            "invalid",
            'import.graph needs a card with id "root"',
          );
      }
      const p = await store.createPathway({
        title: question ?? "",
        notes: args.goals,
        sourceTaskId: task?.id,
        sourceDocId: note?.id,
        graph,
        context:
          (args.import?.goals as PathwayContext | undefined) ?? undefined,
        plan: args.import?.nextSteps ?? undefined,
      });
      await log("pathway.created", p.id, {
        title: p.title,
        imported: !!args.import,
      });
      return mapView(ctx, p);
    },
  );

  tools.write(
    "pathways_edit",
    {
      title: "Edit pathway",
      description:
        'Change a map in one batch. New cards take a ref ("n1") that edges in the same call can use; existing cards use their id. To show paths meeting, add an edge to the existing card. Unknown ids are skipped and listed. goals replaces the goals text; addQuestions adds questions about the person\'s goals (they answer on the page).',
      input: {
        id: z.string().min(1),
        ops: opsArg.optional(),
        goals: z.string().max(8000).optional(),
        addQuestions: z.array(z.string().min(1).max(300)).max(6).optional(),
      },
    },
    async ({ id, ops, goals, addQuestions }) => {
      const { record, result } = await store.writePathway(
        id,
        label("pathways_edit"),
        (d) => {
          const r = applyOps(d.graph, (ops ?? {}) as GraphOps, "agent");
          d.graph = r.graph;
          if (goals !== undefined || addQuestions?.length) {
            d.context ??= { notes: "", qa: [] };
            if (goals !== undefined) d.context.notes = goals;
            for (const q of addQuestions ?? []) d.context.qa.push({ q, a: "" });
          }
          return r;
        },
      );
      await log("pathway.edited", id, {
        added: result.added.length,
        dropped: result.dropped.length,
      });
      return {
        added: titleOf(record.graph, result.added),
        dropped: titleOf(record.graph, result.dropped),
        skipped: result.skipped,
        pathsMeet: meetingPoints(record.graph),
        appUrl: appLink(ctx, `/pathways/${id}`),
      };
    },
  );

  tools.write(
    "pathways_set_plan",
    {
      title: "Set Next steps",
      description:
        "Write the Next steps list: 3-7 concrete actions to do now, in order, each one sitting of work. Replaces open tasks; finished ones stay as history. Use updates to record a task as done or skipped with what happened.",
      input: {
        id: z.string().min(1),
        summary: z
          .string()
          .max(1000)
          .optional()
          .describe("What this set achieves and what it leaves for later"),
        tasks: z
          .array(
            z.object({
              title: z
                .string()
                .min(1)
                .max(200)
                .describe("Verb first, specific, under 12 words"),
              why: z.string().max(500),
              doneWhen: z.string().max(300),
              minutes: z.number().min(1).max(1440),
              nodeIds: z
                .array(z.string())
                .describe("Cards this action moves forward"),
            }),
          )
          .max(10)
          .optional(),
        updates: z
          .array(
            z.object({
              taskId: z.string().min(1),
              status: z.enum(["todo", "done", "skipped"]).optional(),
              result: z.string().max(4000).optional(),
            }),
          )
          .max(20)
          .optional(),
      },
    },
    async ({ id, summary, tasks, updates }) => {
      const { record } = await store.writePathway(
        id,
        label("pathways_set_plan"),
        (d) => {
          if (tasks)
            d.plan = replacePlan(
              d.graph,
              d.plan,
              summary ?? d.plan?.summary ?? "",
              tasks,
            );
          for (const u of updates ?? []) {
            const t = d.plan?.tasks.find((x) => x.id === u.taskId);
            if (!t)
              throw new ConnectorError(
                "not_found",
                `Next steps task ${u.taskId} not found`,
              );
            if (u.status) t.status = u.status;
            if (u.result !== undefined) t.result = u.result;
            t.absorbed = false;
          }
        },
      );
      // An exported step's real task holds its status; set it there too.
      for (const u of updates ?? []) {
        const taskId = record.plan?.tasks.find(
          (t) => t.id === u.taskId,
        )?.taskId;
        if (u.status && taskId) await mirrorStatus(taskId, u.status);
      }
      await log("pathway.planned", id, {
        tasks: tasks?.length ?? 0,
        updates: updates?.length ?? 0,
      });
      return {
        nextSteps: (await withLinkedStatus(record)).plan,
        appUrl: appLink(ctx, `/pathways/${id}?view=next`),
      };
    },
  );

  tools.write(
    "pathways_report_research",
    {
      title: "Report research",
      description:
        "Answer a card's research question (see researchQueue in pathways_get) with findings and the pages you used. Later agent actions read them.",
      openWorld: false,
      input: {
        id: z.string().min(1),
        nodeId: z.string().min(1),
        findings: z
          .string()
          .min(1)
          .max(8000)
          .describe(
            "3-6 short markdown bullets with names, numbers, and dates",
          ),
        sources: z
          .array(z.object({ title: z.string().max(300), url: webUrl }))
          .max(20),
      },
    },
    async ({ id, nodeId, findings, sources }) => {
      await store.writePathway(id, label("pathways_report_research"), (d) => {
        const n = d.graph.nodes.find((x) => x.id === nodeId);
        if (!n)
          throw new ConnectorError("not_found", `Card ${nodeId} not found`);
        n.research = {
          question: n.research?.question ?? n.title,
          status: "done",
          findings,
          sources,
          by: ctx.actorId,
        };
      });
      await log("pathway.researched", id, { nodeId });
      return { ok: true, appUrl: appLink(ctx, `/pathways/${id}`) };
    },
  );

  tools.write(
    "pathways_undo",
    {
      title: "Undo pathway change",
      description:
        "Restore a map to before its last write (yours, the person's, or the in-app agent's).",
      idempotent: false,
      input: { id: z.string().min(1) },
    },
    async ({ id }) => {
      const r = await undoWithTasks(id);
      if (!r) throw new ConnectorError("invalid", "Nothing to undo");
      await log("pathway.undone", id, { label: r.label });
      return { undid: r.label, appUrl: appLink(ctx, `/pathways/${id}`) };
    },
  );
}
