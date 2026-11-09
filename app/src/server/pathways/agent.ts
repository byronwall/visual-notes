import { applyOps, type GraphOps } from "~/lib/pathways/graph-ops";
import { replacePlan, type NewPlanTask } from "~/lib/pathways/plan";
import type { NodeKind, Source } from "~/lib/pathways/types";
import { callLLM } from "~/server/lib/ai";
import {
  ACTIONS,
  MAP_SCHEMA,
  PLAN_SCHEMA,
  QUESTION_SCHEMA,
  RESEARCH_SCHEMA,
  SYSTEM,
  type PathwayAgentAction,
} from "./agent-prompts";
import * as store from "./pathway-store";
import { withLinkedStatus } from "./pathway-tasks";

// The in-app agent. It reads the whole map as text, asks the model for a
// structured reply, and writes the reply back through the store as one
// revision ("agent: <action>"), applied to a fresh read of the map.

const MODEL = process.env.PATHWAYS_MODEL || "gpt-5.4-mini";
const LOG = "[pathways-agent]";

export type AgentRun = {
  record: store.PathwayRecord;
  summary: string;
  /** New card ids, plus merge survivors. */
  added: string[];
  dropped: string[];
  ms: number;
};

type MapReply = {
  summary: string;
  nodes: {
    ref: string;
    kind: Exclude<NodeKind, "root">;
    title: string;
    note: string;
    missed: boolean;
    research: string;
  }[];
  edges: { from: string; to: string }[];
  merges: { keep: string; drop: string; title: string | null }[];
  drops: string[];
  chosen: string[];
  appendNotes: { id: string; text: string }[];
};

const FEEDBACK_TEXT = {
  like: "likes this",
  no: "does not want this",
  more: "wants better options here",
};

function contextText(p: store.PathwayRecord) {
  const c = p.context;
  if (!c) return "";
  const qa = c.qa
    .filter((x) => x.a.trim())
    .map((x) => `- Q: ${x.q}\n  A: ${x.a.trim()}`);
  const parts = [
    c.notes.trim() && `In their words: ${c.notes.trim()}`,
    qa.length && `Answers:\n${qa.join("\n")}`,
  ];
  const body = parts.filter(Boolean).join("\n");
  return body ? `The person's goals and context:\n${body}\n\n` : "";
}

/** The map as the model reads it. */
export function outline(p: store.PathwayRecord) {
  const nodes = p.graph.nodes
    .map((n) => {
      const weight =
        n.weight === "key"
          ? "important to the person"
          : n.weight === "noise"
            ? "noise to the person"
            : "";
      const flags = [n.kind, n.status !== "open" ? n.status : "", weight]
        .filter(Boolean)
        .join(", ");
      const found = n.research?.findings
        ? `\n  Research (${n.research.question}): ${n.research.findings.replace(/\n+/g, " ")}`
        : "";
      const vote = n.feedback?.vote
        ? `\n  Person's reaction: ${FEEDBACK_TEXT[n.feedback.vote]}`
        : "";
      const said = n.feedback?.comment.trim()
        ? `\n  Person's note: "${n.feedback.comment.trim()}"`
        : "";
      return `- ${n.id} [${flags}] ${n.title}${n.note ? ` — ${n.note}` : ""}${found}${vote}${said}`;
    })
    .join("\n");
  const edges = p.graph.edges.map((e) => `- ${e.from} -> ${e.to}`).join("\n");
  const tasks = (p.plan?.tasks ?? [])
    .map((t) => {
      const got = t.result.trim()
        ? `\n  What happened: ${t.result.trim()}`
        : "";
      return `- [${t.status}${t.absorbed ? ", already on the map" : ""}] ${t.title} (cards: ${t.nodeIds.join(", ") || "none"})${got}`;
    })
    .join("\n");
  const plan = tasks ? `\n\nNext steps the person planned:\n${tasks}` : "";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `Today is ${today}.\n\n${contextText(p)}Question: ${p.title}\n\nNodes:\n${nodes}\n\nEdges:\n${edges || "(none)"}${plan}`;
}

async function ask<T>(
  trigger: string,
  system: string,
  user: string,
  schema: Record<string, unknown>,
  tools?: unknown[],
) {
  const { output } = await callLLM({
    model: MODEL,
    system,
    user,
    trigger,
    effort: "medium",
    tools,
    schema: { name: "pathways", schema },
  });
  if (!output) throw new Error("The model returned no text");
  return JSON.parse(output) as T;
}

const steerText = (hint: string) =>
  hint.trim() ? `\n\nThe person adds: ${hint.trim()}` : "";

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
  console.info(`${LOG} ${action} on ${id}/${nodeId} (${MODEL})`);
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
- Fit their goals and context. Favor cards marked important or liked, and follow their notes. Skip anything dropped, noise, or "does not want this".
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

  const reply = await ask<MapReply>(
    `pathways:${action}`,
    SYSTEM,
    `${outline(p)}\n\n${ACTIONS[action](nodeId)}${steerText(hint)}`,
    MAP_SCHEMA,
  );
  const ops: GraphOps = {
    nodes: reply.nodes.map((n) => ({ ...n, missed: n.missed || undefined })),
    edges: reply.edges,
    merges: reply.merges,
    drops: reply.drops,
    chosen: reply.chosen,
    appendNotes: reply.appendNotes,
  };

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
    `agent: ${action}`,
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
    [{ type: "web_search" }],
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
