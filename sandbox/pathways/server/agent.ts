import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { AgentAction, AgentResult, Kind, PMap } from "../src/types";
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

In your response, refer to existing nodes by their id. Give each new node a ref like "n1", "n2" and use those refs in edges. Leave merges empty unless asked to converge.`;

const ACTIONS: Record<AgentAction, (id: string) => string> = {
  options: (id) => `Task: list the distinct options available at node ${id}.
Look at the options that already follow from ${id}. Add 2 to 5 NEW options that are missing. Include at least one the person has probably not considered (set missed=true), for example: wait or do nothing, a hybrid, ask someone, shrink the scope, reverse the question, or remove the need for the decision. Do not repeat existing options. Each new option is kind "option" with an edge from ${id}.`,
  forward: (id) => `Task: play forward from node ${id}, 1 to 3 steps ahead along the most likely path.
Return a short chain of step nodes, with at most one fork where the path really splits. End with an outcome node when the end state is clear. Before you create each node, check the whole map: if it matches an existing node, add an edge to that id instead (this is how paths converge). The first new edge starts at ${id}. Set missed=false.`,
  converge: () => `Task: find where different paths arrive at the same practical state.
1. Return merges for nodes that are duplicates or near-duplicates (keep one id, drop the other, give the merged title). Never drop root. Do not merge two options at the same decision point unless they lead to the exact same next state.
2. Where several options really end in the same place but no shared node exists yet, add one outcome node and edges into it from the last node of each path.
Use summary to state the key insight in one or two sentences, for example "A and B both end in X; the real choice is about timing." Set missed=false.`,
};

const nullable = (type: string) => ({ type: [type, "null"] });
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "nodes", "edges", "merges"],
  properties: {
    summary: { type: "string" },
    nodes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref", "kind", "title", "note", "missed"],
        properties: {
          ref: { type: "string" },
          kind: { type: "string", enum: ["option", "step", "outcome"] },
          title: { type: "string" },
          note: { type: "string" },
          missed: { type: "boolean" },
        },
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to"],
        properties: { from: { type: "string" }, to: { type: "string" } },
      },
    },
    merges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["keep", "drop", "title"],
        properties: { keep: { type: "string" }, drop: { type: "string" }, title: nullable("string") },
      },
    },
  },
};

type Reply = {
  summary: string;
  nodes: { ref: string; kind: Kind; title: string; note: string; missed: boolean }[];
  edges: { from: string; to: string }[];
  merges: { keep: string; drop: string; title: string | null }[];
};

function outline(map: PMap) {
  const nodes = map.nodes
    .map((n) => {
      const flags = [n.kind, n.status !== "open" ? n.status : ""].filter(Boolean).join(", ");
      return `- ${n.id} [${flags}] ${n.title}${n.note ? ` — ${n.note}` : ""}`;
    })
    .join("\n");
  const edges = map.edges.map((e) => `- ${e.from} -> ${e.to}`).join("\n");
  return `Question: ${map.title}\n\nNodes:\n${nodes}\n\nEdges:\n${edges || "(none)"}`;
}

async function ask(prompt: string): Promise<Reply> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({
      model: MODEL,
      reasoning: { effort: EFFORT },
      instructions: SYSTEM,
      input: prompt,
      text: { format: { type: "json_schema", name: "pathways", strict: true, schema: SCHEMA } },
    }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 300)}`);
  const json = JSON.parse(txt);
  const out = (json.output ?? [])
    .flatMap((o: any) => o.content ?? [])
    .find((c: any) => c.type === "output_text")?.text;
  if (!out) throw new Error("OpenAI returned no text");
  return JSON.parse(out) as Reply;
}

/** Applies the reply to a copy of the map. Unknown ids and self-loops are dropped. */
function apply(map: PMap, reply: Reply): { map: PMap; added: string[] } {
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

  const seen = new Set<string>();
  next.edges = next.edges.filter((e) => {
    const k = `${e.from}>${e.to}`;
    if (e.from === e.to || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { map: next, added };
}

export async function runAgent(
  map: PMap,
  action: AgentAction,
  nodeId: string,
  hint: string,
): Promise<AgentResult> {
  const steer = hint.trim() ? `\n\nThe person adds: ${hint.trim()}` : "";
  const prompt = `${outline(map)}\n\n${ACTIONS[action](nodeId)}${steer}`;
  console.info(`[pathways] agent ${action} on ${nodeId} (${MODEL}, ${EFFORT})`);
  const reply = await ask(prompt);
  const { map: next, added } = apply(map, reply);
  return { map: next, summary: reply.summary, added };
}
