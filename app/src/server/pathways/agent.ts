import { applyOps } from "~/lib/pathways/graph-ops";
import { replacePlan, type NewPlanTask } from "~/lib/pathways/plan";
import type { Source } from "~/lib/pathways/types";
import { callLLM } from "~/server/lib/ai";
import {
  contextText,
  firstAction,
  mapPrompt,
  outline,
  replyToOps,
  steerText,
  type MapReply,
} from "./agent-input";
import {
  PLAN_SCHEMA,
  QUESTION_SCHEMA,
  RESEARCH_SCHEMA,
  schemaFor,
  type PathwayAgentAction,
} from "./agent-prompts";
import * as store from "./pathway-store";
import { withLinkedStatus } from "./pathway-tasks";

// The in-app agent. It reads the whole map as text, asks the model for a
// structured reply, and writes the reply back through the store as one
// revision ("agent: <action>"), applied to a fresh read of the map.

// Picked with `pnpm eval:pathways` (see app/docs/pathways-agent.md): Terra
// does every action well; Sol at low effort builds clearly better whole maps,
// which happens about once per map.
const MODEL = process.env.PATHWAYS_MODEL || "gpt-6.1-terra";
const MAP_MODEL = process.env.PATHWAYS_MAP_MODEL || "gpt-6.1-sol";
const WHOLE_MAP: PathwayAgentAction[] = ["start", "regenerate"];
const LOG = "[pathways-agent]";

export type AgentRun = {
  record: store.PathwayRecord;
  summary: string;
  /** New card ids, plus merge survivors. */
  added: string[];
  dropped: string[];
  ms: number;
};

async function ask<T>(
  trigger: string,
  system: string,
  user: string,
  schema: Record<string, unknown>,
  opts: { tools?: unknown[]; wholeMap?: boolean } = {},
) {
  const model = opts.wholeMap ? MAP_MODEL : MODEL;
  const effort = opts.wholeMap ? "low" : "medium";
  console.info(`${LOG} ${trigger} on ${model} (${effort})`);
  const { output } = await callLLM({
    model,
    system,
    user,
    trigger,
    effort,
    tools: opts.tools,
    schema: { name: "pathways", schema },
  });
  if (!output) throw new Error("The model returned no text");
  return JSON.parse(output) as T;
}

export async function runPathwayAgent(
  id: string,
  action: PathwayAgentAction,
  nodeId: string,
  hint: string,
): Promise<AgentRun> {
  const t0 = Date.now();
  const raw = await store.getPathway(id);
  if (!raw) throw new Error(`Pathway ${id} not found`);
  // Exported steps read their real task's status (done on the Tasks page counts).
  const p = await withLinkedStatus(raw);
  console.info(`${LOG} ${action} on ${id}/${nodeId}`);
  const done = (r: Omit<AgentRun, "ms">): AgentRun => {
    const ms = Date.now() - t0;
    console.info(
      `${LOG} ${action} on ${id} done in ${(ms / 1000).toFixed(1)}s`,
    );
    return { ...r, ms };
  };

  if (action === "questions") {
    const asked = p.context?.qa.map((x) => `- ${x.q}`).join("\n") || "(none)";
    const reply = await ask<{ summary: string; questions: string[] }>(
      "pathways:questions",
      "You coach a person through a decision. You ask about the person, not about the individual tasks.",
      `${outline(p)}

Questions already asked:
${asked}

Task: ask 3 or 4 short questions that collect the person's goals and the overall feel they want, apart from the individual options. Cover what a good result looks like a month from now, what they care about most (energy, speed, relationships, money, learning, fun), hard limits (time, budget, people), and what would make them regret a choice. Prefer questions whose answers would change which path is best. One sentence each, plain words. Do not repeat a question already asked.${steerText(hint)}
In summary, say in one sentence why these questions matter for this map.`,
      QUESTION_SCHEMA,
    );
    const { record } = await store.writePathway(id, "agent: questions", (d) => {
      d.context ??= { notes: "", qa: [] };
      d.context.qa.push(...reply.questions.map((q) => ({ q, a: "" })));
    });
    return done({ record, summary: reply.summary, added: [], dropped: [] });
  }

  if (action === "plan") {
    const reply = await ask<{ summary: string; tasks: NewPlanTask[] }>(
      "pathways:plan",
      "You turn a person's decision map into the few next actions most worth doing now. You are concrete and ruthless about priority.",
      `${outline(p)}

Task: pick the 3 to 7 best next actions the person can do in the next few days.
- Fit their goals and context. Favor cards marked important or liked, and follow their notes. Skip anything done, dropped, noise, or "does not want this".
- Do first what keeps the most good paths open: shared prerequisites where paths meet, cheap ways to get information that would settle a choice, and quick outreach that others must answer.
- Each action is one sitting of work: verb first, specific (names, places, what to send), under 12 words.
- why: one sentence on which path it moves and why now.
- doneWhen: one sentence the person can check.
- minutes: a realistic estimate.
- nodeIds: the existing card ids this action moves forward (at least one).
- Order them in the order to do them. Do not repeat a done task unless its result calls for a follow-up.${steerText(hint)}
In summary, say in one or two sentences what this set of actions achieves and what it deliberately leaves for later.`,
      PLAN_SCHEMA,
    );
    const { record } = await store.writePathway(id, "agent: plan", (d) => {
      d.plan = replacePlan(d.graph, d.plan, reply.summary, reply.tasks);
    });
    return done({ record, summary: reply.summary, added: [], dropped: [] });
  }

  const run = firstAction(action, p.graph, nodeId);
  if (
    run === "fromResearch" &&
    !p.graph.nodes.find((n) => n.id === nodeId)?.research?.findings
  )
    throw new Error("This card has no research findings yet");
  const prompt = mapPrompt(run, p, nodeId, hint);
  const reply = await ask<MapReply>(
    `pathways:${run}`,
    prompt.system,
    prompt.user,
    schemaFor(run),
    { wholeMap: WHOLE_MAP.includes(run) },
  );
  const ops = replyToOps(reply, run === "fromResearch" ? nodeId : undefined);

  if (action === "regenerate") {
    // A fresh version is a new map, so the old one stays as it was.
    const n = Number(p.title.match(/ · v(\d+)$/)?.[1] ?? "1");
    const fresh = await store.createPathway({
      title: `${p.title.replace(/ · v\d+$/, "")} · v${n + 1}`,
      context: p.context,
      sourceTaskId: p.sourceTaskId,
      sourceDocId: p.sourceDocId,
    });
    const { record, result } = await store.writePathway(
      fresh.id,
      "agent: fresh map",
      (d) => {
        const r = applyOps(d.graph, ops, "agent");
        d.graph = r.graph;
        return r;
      },
    );
    return done({
      record,
      summary: reply.summary,
      added: result.added,
      dropped: result.dropped,
    });
  }

  const { record, result } = await store.writePathway(
    id,
    `agent: ${run}`,
    (d) => {
      const r = applyOps(d.graph, ops, "agent");
      d.graph = r.graph;
      // Requests for better options are handled once the agent has acted on them.
      if (action === "improve")
        for (const x of d.graph.nodes)
          if (x.feedback?.vote === "more") delete x.feedback.vote;
      // Results are on the map now; the next plan builds on them instead of re-reading them.
      if (action === "absorb") {
        const finished = new Map(
          (p.plan?.tasks ?? [])
            .filter((t) => t.status !== "todo")
            .map((t) => [t.id, t.status]),
        );
        for (const t of d.plan?.tasks ?? []) {
          const status = finished.get(t.id);
          if (status) Object.assign(t, { status, absorbed: true });
        }
      }
      return r;
    },
  );
  return done({
    record,
    summary: reply.summary,
    added: result.added,
    dropped: result.dropped,
  });
}

/** Answers a card's research question with OpenAI's web search tool. */
export async function runPathwayResearch(id: string, nodeId: string) {
  const p = await store.getPathway(id);
  const node = p?.graph.nodes.find((n) => n.id === nodeId);
  if (!p || !node?.research)
    throw new Error("This card has no research question");
  const t0 = Date.now();
  const reply = await ask<{ findings: string; sources: Source[] }>(
    "pathways:research",
    "You research one question on the web for a person making a decision. Report only what sources support. Be concise.",
    `${contextText(p)}Decision: ${p.title}
Card: ${node.title}${node.note ? ` — ${node.note}` : ""}
Research question: ${node.research.question}

Search the web. Write findings as 3 to 6 short markdown bullets with concrete names, numbers, and dates. Say plainly what you could not find. List the pages you used in sources.`,
    RESEARCH_SCHEMA,
    { tools: [{ type: "web_search" }] },
  );
  console.info(
    `${LOG} research on ${id}/${nodeId} done in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
  const { record } = await store.writePathway(id, "agent: research", (d) => {
    const n = d.graph.nodes.find((x) => x.id === nodeId);
    if (n?.research)
      n.research = {
        ...n.research,
        ...reply,
        status: "done",
        by: "in-app web search",
      };
  });
  return record;
}
