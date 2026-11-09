import type { GraphOps } from "~/lib/pathways/graph-ops";
import {
  ROOT_ID,
  type NodeKind,
  type PathwayContext,
  type PathwayGraph,
  type PathwayPlan,
} from "~/lib/pathways/types";
import { ACTIONS, SYSTEM, type MapAction } from "./agent-prompts";

// What the in-app agent sends the model, built from a map alone (no
// database), so `scripts/pathways-eval.ts` scores the exact prompts the app
// sends.

/** The parts of a pathway the prompts read. */
export type MapInput = {
  title: string;
  context: PathwayContext | null;
  graph: PathwayGraph;
  plan: PathwayPlan | null;
};

const FEEDBACK_TEXT = {
  like: "likes this",
  no: "does not want this",
  more: "wants better options here",
};

export function contextText(p: Pick<MapInput, "context">) {
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
export function outline(p: MapInput, now = new Date()) {
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
  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `Today is ${today}.\n\n${contextText(p)}Question: ${p.title}\n\nNodes:\n${nodes}\n\nEdges:\n${edges || "(none)"}${plan}`;
}

export const steerText = (hint: string) =>
  hint.trim() ? `\n\nThe person adds: ${hint.trim()}` : "";

/** The system and user text for one map-editing action. */
export function mapPrompt(
  action: MapAction,
  p: MapInput,
  nodeId: string,
  hint: string,
  now?: Date,
) {
  return {
    system: SYSTEM,
    user: `${outline(p, now)}\n\n${ACTIONS[action](nodeId)}${steerText(hint)}`,
  };
}

/**
 * The action the agent really runs. "More options" on a map that is only its
 * question builds a whole first map; a first map on a map that already has
 * cards (another tab got there first) only adds options.
 */
export function firstAction(
  action: MapAction,
  graph: PathwayGraph,
  nodeId: string,
): MapAction {
  const blank = graph.nodes.length === 1;
  if (action === "start" && !blank) return "options";
  return action === "options" && nodeId === ROOT_ID && blank ? "start" : action;
}

/** The model's reply to a map action (see MAP_SCHEMA). */
export type MapReply = {
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
  updates: { id: string; title: string; note: string }[];
};

export const replyToOps = (r: MapReply): GraphOps => ({
  nodes: r.nodes.map((n) => ({ ...n, missed: n.missed || undefined })),
  edges: r.edges,
  merges: r.merges,
  drops: r.drops,
  chosen: r.chosen,
  appendNotes: r.appendNotes,
  // The root card is the person's question; the agent does not rewrite it.
  update: r.updates
    .filter((u) => u.id !== ROOT_ID)
    .map((u) => ({
      id: u.id,
      title: u.title || undefined,
      note: u.note || undefined,
    })),
});
