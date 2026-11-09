// Shared by the browser and the dev-server API. The map file on disk is a PMap.

export type Kind = "root" | "option" | "step" | "outcome";
export type Status = "open" | "chosen" | "dropped";

export type Source = { title: string; url: string };

/**
 * Facts a node needs from outside the map. "suggested" comes from the agent;
 * "queued" waits for an outside agent (GET /api/research lists these).
 */
export type Research = {
  question: string;
  status: "suggested" | "queued" | "running" | "done";
  findings?: string;
  sources?: Source[];
  by?: string;
};

/** The person's take on a card: an optional quick reaction and/or free text. */
export type Feedback = { vote?: "like" | "no" | "more"; comment: string };

export type PNode = {
  id: string;
  kind: Kind;
  title: string;
  note: string;
  by: "me" | "agent";
  status: Status;
  /** The agent thinks you probably had not considered this. */
  missed?: boolean;
  research?: Research;
  feedback?: Feedback;
  /** How much the node matters to the person. Noise shrinks and moves to the edges; nothing is lost. */
  weight?: "key" | "noise";
};

export type PEdge = { from: string; to: string };

/** Map-wide goals and vibes. Every agent prompt includes them. */
export type MapContext = {
  notes: string;
  qa: { q: string; a: string }[];
};

/** One curated next action, done outside the app and reported back. */
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
};

export type Plan = { createdAt: string; summary: string; tasks: PlanTask[] };

export type PMap = {
  id: string;
  title: string;
  nodes: PNode[];
  edges: PEdge[];
  context?: MapContext;
  plan?: Plan;
  updatedAt: string;
};

export type MapInfo = { id: string; title: string; updatedAt: string };

export type AgentAction = "options" | "forward" | "converge" | "questions" | "improve" | "regenerate" | "plan" | "absorb";

export type AgentResult = { map: PMap; summary: string; added: string[]; ms: number; dropped?: string[] };

export type QueuedResearch = { mapId: string; mapTitle: string; nodeId: string; title: string; question: string };
