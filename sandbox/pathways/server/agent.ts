import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { AgentAction, AgentResult, Kind, PMap, PlanTask, Source } from "../src/types";
import { newId } from "./store";

const MODEL = process.env.PATHWAYS_MODEL || "gpt-5.4-mini";
const EFFORT = process.env.PATHWAYS_EFFORT || "medium";

// Use OPENAI_API_KEY from the shell, else the main checkout's app/.env. Only
// that one key is read from the file.
function apiKey(): string {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const common = execSync("git rev-parse --path-format=absolute --git-common-dir", {
    encoding: "utf8",
  }).trim();
  const envFile = path.join(path.dirname(common), "app", ".env");
  const line = fs
    .readFileSync(envFile, "utf8")
    .split("\n")
    .find((l) => l.startsWith("OPENAI_API_KEY="));
  const key = line?.slice("OPENAI_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
  if (!key) throw new Error("No OPENAI_API_KEY in the shell or the main app/.env");
  return key;
}

const SYSTEM = `You help a person get unstuck on a decision by mapping it as a choose-your-own-adventure graph.

Node kinds:
- root: the question being decided.
- option: a choice the person could make at a decision point.
- step: a concrete thing that happens or must be done after a choice.
- outcome: a state the person ends up in.

Edges point forward in time. Different paths often lead to the SAME node, and showing that is the main goal: when a step or outcome is materially the same as a node already on the map, add an edge to that existing id instead of creating a near-duplicate.

Write short, concrete titles (under 12 words, plain words, no fluff). Use note for one sentence on the why, cost, or tradeoff. Never re-create a node that already exists.

Research: when acting on a new node needs facts you do not have and that a web search could find (names of companies or people, prices, dates, availability, how something works), put one specific research question in its research field. Otherwise use an empty string. Never invent those facts yourself.

A "Person's note" on a node is the person's own words about it; follow it in everything you add after that node.

Nodes marked "important to the person" deserve the most thought; do not expand nodes marked "noise" or "dropped".

The person's goals and context, when given, come first: prefer options and steps that fit them, and say so in the note when a node conflicts with them.

In your response, refer to existing nodes by their id. Give each new node a ref like "n1", "n2" and use those refs in edges. Leave merges, drops, chosen, and appendNotes empty unless the task asks for them.`;

const ACTIONS: Record<Exclude<AgentAction, "questions" | "plan">, (id: string) => string> = {
  absorb: () => `Task: the person went and did things (see "Next steps" above, with what happened). Update the map so it matches reality now.
- Put cards the person acted on, or committed to, in chosen.
- Put paths that the results ruled out in drops.
- Add steps or outcomes for new facts, new options, or new problems the results revealed, linked where they belong. Reuse existing cards where paths meet.
- In appendNotes, add one short dated line ("Nov 9: ...") to each card a result changed, saying what happened.
Only use what the results say; do not invent outcomes. Ignore tasks that are still todo.
In summary, say in one or two sentences what changed and what is now the most open question.`,
  improve: () => `Task: improve the map using the person's reactions and notes (marked "Person's reaction" and "Person's note" above).
- A note is the person's own words about that card. Follow it: it may ask for a change, add a fact, or set a direction for what comes after the card.
- "does not want this": put the node id in drops (it is marked dropped, not deleted). Also drop steps that only that node leads to.
- "wants better options here": add 2 to 4 better alternatives as siblings (edges from the same parents), and use the comment to aim them. Make them clearly different from what is there.
- "likes this": if the node has nothing after it, play it forward 1 or 2 steps. Add at most one new option elsewhere in the same spirit.
Reuse existing nodes where paths meet. Never drop root.
In summary, say in one or two sentences what you changed and what you learned about the person's taste.`,
  regenerate: () => `Task: build a FRESH map for the same question. The map above is the old version, shown only so you can learn from it; do not reference its ids except root.
Start at root. Add 4 to 6 options, each played forward 1 or 2 steps, and end paths in shared outcome nodes where they really meet. Learn from the person's reactions: leave out what they rejected, lean into what they liked, and replace areas where they wanted better options with genuinely different ideas. Keep anything they liked, rewritten if useful. Fit their goals and context.
In summary, say in one or two sentences how this version differs from the old one.`,
  options: (id) => `Task: list the distinct options available at node ${id}.
Look at the options that already follow from ${id}. Add 2 to 5 NEW options that are missing. Include at least one the person has probably not considered (set missed=true), for example: wait or do nothing, a hybrid, ask someone, shrink the scope, reverse the question, or remove the need for the decision. Do not repeat existing options. Each new option is kind "option" with an edge from ${id}.
In summary, say in one sentence what kind of options you added.`,
  forward: (id) => `Task: play forward from node ${id}, 1 to 3 steps ahead along the most likely path.
Return a short chain of step nodes, with at most one fork where the path really splits. End with an outcome node when the end state is clear. Before you create each node, check the whole map: if it matches an existing node, add an edge to that id instead (this is how paths converge). The first new edge starts at ${id}. Set missed=false.
In summary, say in one sentence where this path leads, and name any existing node it joins.`,
  converge: () => `Task: find where different paths arrive at the same practical state.
1. Return merges for nodes that are duplicates or near-duplicates (keep one id, drop the other, give the merged title). Never drop root. Do not merge two options at the same decision point unless they lead to the exact same next state.
2. Where several options really end in the same place but no shared node exists yet, add one outcome node and edges into it from the last node of each path.
Use summary to state the key insight in one or two sentences, for example "A and B both end in X; the real choice is about timing." Set missed=false.`,
};

const nullable = (type: string) => ({ type: [type, "null"] });
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

const MAP_SCHEMA = obj({
  summary: { type: "string" },
  nodes: {
    type: "array",
    items: obj({
      ref: { type: "string" },
      kind: { type: "string", enum: ["option", "step", "outcome"] },
      title: { type: "string" },
      note: { type: "string" },
      missed: { type: "boolean" },
      research: { type: "string" },
    }),
  },
  edges: { type: "array", items: obj({ from: { type: "string" }, to: { type: "string" } }) },
  merges: {
    type: "array",
    items: obj({ keep: { type: "string" }, drop: { type: "string" }, title: nullable("string") }),
  },
  drops: { type: "array", items: { type: "string" } },
  chosen: { type: "array", items: { type: "string" } },
  appendNotes: { type: "array", items: obj({ id: { type: "string" }, text: { type: "string" } }) },
});

const PLAN_SCHEMA = obj({
  summary: { type: "string" },
  tasks: {
    type: "array",
    items: obj({
      title: { type: "string" },
      why: { type: "string" },
      doneWhen: { type: "string" },
      minutes: { type: "number" },
      nodeIds: { type: "array", items: { type: "string" } },
    }),
  },
});

const QUESTION_SCHEMA = obj({
  summary: { type: "string" },
  questions: { type: "array", items: { type: "string" } },
});

const RESEARCH_SCHEMA = obj({
  findings: { type: "string" },
  sources: { type: "array", items: obj({ title: { type: "string" }, url: { type: "string" } }) },
});

type Reply = {
  summary: string;
  nodes: { ref: string; kind: Kind; title: string; note: string; missed: boolean; research: string }[];
  edges: { from: string; to: string }[];
  merges: { keep: string; drop: string; title: string | null }[];
  drops: string[];
  chosen: string[];
  appendNotes: { id: string; text: string }[];
};

const FEEDBACK_TEXT = { like: "likes this", no: "does not want this", more: "wants better options here" };

function contextText(map: PMap) {
  const c = map.context;
  if (!c) return "";
  const qa = c.qa.filter((x) => x.a.trim()).map((x) => `- Q: ${x.q}\n  A: ${x.a.trim()}`);
  const parts = [c.notes.trim() && `In their words: ${c.notes.trim()}`, qa.length && `Answers:\n${qa.join("\n")}`];
  const body = parts.filter(Boolean).join("\n");
  return body ? `The person's goals and context:\n${body}\n\n` : "";
}

function outline(map: PMap) {
  const nodes = map.nodes
    .map((n) => {
      const weight = n.weight === "key" ? "important to the person" : n.weight === "noise" ? "noise to the person" : "";
      const flags = [n.kind, n.status !== "open" ? n.status : "", weight].filter(Boolean).join(", ");
      const found = n.research?.findings ? `\n  Research (${n.research.question}): ${n.research.findings.replace(/\n+/g, " ")}` : "";
      const vote = n.feedback?.vote ? `\n  Person's reaction: ${FEEDBACK_TEXT[n.feedback.vote]}` : "";
      const said = n.feedback?.comment.trim() ? `\n  Person's note: "${n.feedback.comment.trim()}"` : "";
      const fb = vote + said;
      return `- ${n.id} [${flags}] ${n.title}${n.note ? ` — ${n.note}` : ""}${found}${fb}`;
    })
    .join("\n");
  const edges = map.edges.map((e) => `- ${e.from} -> ${e.to}`).join("\n");
  const tasks = (map.plan?.tasks ?? [])
    .map((t) => {
      const got = t.result.trim() ? `\n  What happened: ${t.result.trim()}` : "";
      return `- [${t.status}${t.absorbed ? ", already on the map" : ""}] ${t.title} (cards: ${t.nodeIds.join(", ") || "none"})${got}`;
    })
    .join("\n");
  const plan = tasks ? `\n\nNext steps the person planned:\n${tasks}` : "";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  return `Today is ${today}.\n\n${contextText(map)}Question: ${map.title}\n\nNodes:\n${nodes}\n\nEdges:\n${edges || "(none)"}${plan}`;
}

async function ask<T>(
  instructions: string,
  prompt: string,
  schema: Record<string, unknown>,
  tools?: unknown[],
): Promise<T> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({
      model: MODEL,
      reasoning: { effort: EFFORT },
      instructions,
      input: prompt,
      ...(tools ? { tools } : {}),
      text: { format: { type: "json_schema", name: "pathways", strict: true, schema } },
    }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 300)}`);
  const json = JSON.parse(txt);
  const out = (json.output ?? [])
    .flatMap((o: any) => o.content ?? [])
    .find((c: any) => c.type === "output_text")?.text;
  if (!out) throw new Error("OpenAI returned no text");
  return JSON.parse(out) as T;
}

/** Applies the reply to a copy of the map. Unknown ids and self-loops are dropped. */
function apply(map: PMap, reply: Reply): { map: PMap; added: string[]; dropped: string[] } {
  const next: PMap = structuredClone(map);
  const ids = new Map<string, string>();
  for (const n of next.nodes) ids.set(n.id, n.id);
  const added: string[] = [];

  for (const n of reply.nodes) {
    if (!n.title.trim()) continue;
    const id = newId();
    ids.set(n.ref, id);
    added.push(id);
    next.nodes.push({
      id,
      kind: n.kind,
      title: n.title.trim(),
      note: n.note.trim(),
      by: "agent",
      status: "open",
      ...(n.missed ? { missed: true } : {}),
      ...(n.research.trim() ? { research: { question: n.research.trim(), status: "suggested" as const } } : {}),
    });
  }

  for (const e of reply.edges) {
    const from = ids.get(e.from);
    const to = ids.get(e.to);
    if (from && to) next.edges.push({ from, to });
  }

  for (const m of reply.merges) {
    const keep = ids.get(m.keep);
    const drop = ids.get(m.drop);
    if (!keep || !drop || keep === drop || drop === "root") continue;
    next.nodes = next.nodes.filter((n) => n.id !== drop);
    next.edges = next.edges.map((e) => ({
      from: e.from === drop ? keep : e.from,
      to: e.to === drop ? keep : e.to,
    }));
    const kept = next.nodes.find((n) => n.id === keep);
    if (kept && m.title) kept.title = m.title;
    if (kept) added.push(keep);
  }

  const dropped: string[] = [];
  for (const id of reply.drops) {
    const n = next.nodes.find((x) => x.id === ids.get(id));
    if (!n || n.id === "root") continue;
    n.status = "dropped";
    dropped.push(n.id);
  }

  for (const id of reply.chosen) {
    const n = next.nodes.find((x) => x.id === ids.get(id));
    if (n && n.id !== "root") n.status = "chosen";
  }
  for (const a of reply.appendNotes) {
    const n = next.nodes.find((x) => x.id === ids.get(a.id));
    if (n && a.text.trim()) n.note = n.note ? `${n.note}\n${a.text.trim()}` : a.text.trim();
  }

  const seen = new Set<string>();
  next.edges = next.edges.filter((e) => {
    const k = `${e.from}>${e.to}`;
    if (e.from === e.to || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { map: next, added, dropped };
}

async function askQuestions(map: PMap, hint: string) {
  const asked = map.context?.qa.map((x) => `- ${x.q}`).join("\n") || "(none)";
  const reply = await ask<{ summary: string; questions: string[] }>(
    "You coach a person through a decision. You ask about the person, not about the individual tasks.",
    `${outline(map)}

Questions already asked:
${asked}

Task: ask 3 or 4 short questions that collect the person's goals and the overall feel they want, apart from the individual options. Cover what a good result looks like a month from now, what they care about most (energy, speed, relationships, money, learning, fun), hard limits (time, budget, people), and what would make them regret a choice. Prefer questions whose answers would change which path is best. One sentence each, plain words. Do not repeat a question already asked.${hint.trim() ? `\n\nThe person adds: ${hint.trim()}` : ""}
In summary, say in one sentence why these questions matter for this map.`,
    QUESTION_SCHEMA,
  );
  const next = structuredClone(map);
  next.context ??= { notes: "", qa: [] };
  next.context.qa.push(...reply.questions.map((q) => ({ q, a: "" })));
  return { map: next, summary: reply.summary, added: [] };
}

async function askPlan(map: PMap, hint: string) {
  const reply = await ask<{ summary: string; tasks: Omit<PlanTask, "id" | "status" | "result">[] }>(
    "You turn a person's decision map into the few next actions most worth doing now. You are concrete and ruthless about priority.",
    `${outline(map)}

Task: pick the 3 to 7 best next actions the person can do in the next few days.
- Fit their goals and context. Favor cards marked important or liked, and follow their notes. Skip anything dropped, noise, or "does not want this".
- Do first what keeps the most good paths open: shared prerequisites where paths meet, cheap ways to get information that would settle a choice, and quick outreach that others must answer.
- Each action is one sitting of work: verb first, specific (names, places, what to send), under 12 words.
- why: one sentence on which path it moves and why now.
- doneWhen: one sentence the person can check.
- minutes: a realistic estimate.
- nodeIds: the existing card ids this action moves forward (at least one).
- Order them in the order to do them. Do not repeat a done task unless its result calls for a follow-up.${hint.trim() ? `

The person adds: ${hint.trim()}` : ""}
In summary, say in one or two sentences what this set of actions achieves and what it deliberately leaves for later.`,
    PLAN_SCHEMA,
  );
  const next = structuredClone(map);
  const ids = new Set(map.nodes.map((n) => n.id));
  // Keep finished tasks as history; replace the open ones.
  const kept = (map.plan?.tasks ?? []).filter((t) => t.status !== "todo");
  next.plan = {
    createdAt: new Date().toISOString(),
    summary: reply.summary,
    tasks: [
      ...reply.tasks.map((t) => ({
        ...t,
        id: newId(),
        minutes: Math.max(5, Math.round(t.minutes)),
        nodeIds: t.nodeIds.filter((id) => ids.has(id)),
        status: "todo" as const,
        result: "",
      })),
      ...kept,
    ],
  };
  return { map: next, summary: reply.summary, added: [] };
}

/**
 * Runs one agent action on `map`. For "regenerate", `map` is the old version the
 * prompt learns from and `target` is the new map (root only) the reply fills.
 */
export async function runAgent(
  map: PMap,
  action: AgentAction,
  nodeId: string,
  hint: string,
  target: PMap = map,
): Promise<AgentResult> {
  const t0 = Date.now();
  console.info(`[pathways] agent ${action} on ${nodeId} (${MODEL}, ${EFFORT}) start`);
  let result: Omit<AgentResult, "ms">;
  if (action === "questions") {
    result = await askQuestions(map, hint);
  } else if (action === "plan") {
    result = await askPlan(map, hint);
  } else {
    const steer = hint.trim() ? `\n\nThe person adds: ${hint.trim()}` : "";
    const reply = await ask<Reply>(SYSTEM, `${outline(map)}\n\n${ACTIONS[action](nodeId)}${steer}`, MAP_SCHEMA);
    const applied = apply(target, reply);
    // Requests for better options are handled once the agent has acted on them.
    if (action === "improve") for (const n of applied.map.nodes) if (n.feedback?.vote === "more") delete n.feedback;
    // Results are on the map now; the next plan builds on them instead of re-reading them.
    if (action === "absorb") for (const t of applied.map.plan?.tasks ?? []) if (t.status !== "todo") t.absorbed = true;
    result = { ...applied, summary: reply.summary };
  }
  const ms = Date.now() - t0;
  console.info(`[pathways] agent ${action} on ${nodeId} done in ${(ms / 1000).toFixed(1)}s`);
  return { ...result, ms };
}

/** Answers a node's research question with OpenAI's web search tool. */
export async function runResearch(map: PMap, nodeId: string) {
  const node = map.nodes.find((n) => n.id === nodeId);
  if (!node?.research) throw new Error("This node has no research question");
  const t0 = Date.now();
  console.info(`[pathways] research on ${nodeId} start: ${node.research.question}`);
  const reply = await ask<{ findings: string; sources: Source[] }>(
    "You research one question on the web for a person making a decision. Report only what sources support. Be concise.",
    `${contextText(map)}Decision: ${map.title}
Node: ${node.title}${node.note ? ` — ${node.note}` : ""}
Research question: ${node.research.question}

Search the web. Write findings as 3 to 6 short markdown bullets with concrete names, numbers, and dates. Say plainly what you could not find. List the pages you used in sources.`,
    RESEARCH_SCHEMA,
    [{ type: "web_search" }],
  );
  console.info(`[pathways] research on ${nodeId} done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return reply;
}
