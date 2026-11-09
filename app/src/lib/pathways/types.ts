// JSON shapes stored on a Pathway row (see prisma/schema.prisma). Shared by
// the page, the in-app agent, and the MCP tools.

export type NodeKind = "root" | "option" | "step" | "outcome";
export type NodeStatus = "open" | "chosen" | "dropped";

export type Source = { title: string; url: string };

/**
 * Facts a card needs from outside the map. "suggested" comes from the agent;
 * "queued" waits for an outside agent (MCP).
 */
export type Research = {
  question: string;
  status: "suggested" | "queued" | "done";
  findings?: string;
  sources?: Source[];
  by?: string;
};

/** The person's take on a card: an optional quick reaction and/or free text. */
export type Feedback = { vote?: "like" | "no" | "more"; comment: string };

export type PathwayNode = {
  id: string;
  kind: NodeKind;
  title: string;
  note: string;
  by: "me" | "agent";
  status: NodeStatus;
  /** The agent thinks the person had not considered this. */
  missed?: boolean;
  research?: Research;
  feedback?: Feedback;
  /** Noise shrinks and moves to the edges; nothing is lost. */
  weight?: "key" | "noise";
};

export type PathwayEdge = { from: string; to: string };

export type PathwayGraph = { nodes: PathwayNode[]; edges: PathwayEdge[] };

/** Goals and vibes. Every agent prompt includes them. */
export type PathwayContext = { notes: string; qa: { q: string; a: string }[] };

/** One curated next action, done outside the map and reported back. */
export type PlanTask = {
  id: string;
  title: string;
  why: string;
  doneWhen: string;
  minutes: number;
  /** Cards this task moves forward. */
  nodeIds: string[];
  status: "todo" | "done" | "skipped";
  /** What happened, in the person's words. */
  result: string;
  /** Set once "Update map from what happened" has read this result. */
  absorbed?: boolean;
  /** The real task this was exported to. Its status wins over `status`. */
  taskId?: string;
};

export type PathwayPlan = { createdAt: string; summary: string; tasks: PlanTask[] };

export const ROOT_ID = "root";

export const emptyGraph = (title: string): PathwayGraph => ({
  nodes: [{ id: ROOT_ID, kind: "root", title, note: "", by: "me", status: "open" }],
  edges: [],
});
