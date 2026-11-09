// Shared by the browser and the dev-server API. The map file on disk is a PMap.

export type Kind = "root" | "option" | "step" | "outcome";
export type Status = "open" | "chosen" | "dropped";

export type PNode = {
  id: string;
  kind: Kind;
  title: string;
  note: string;
  by: "me" | "agent";
  status: Status;
  /** The agent thinks you probably had not considered this. */
  missed?: boolean;
};

export type PEdge = { from: string; to: string };

export type PMap = {
  id: string;
  title: string;
  nodes: PNode[];
  edges: PEdge[];
  updatedAt: string;
};

export type MapInfo = { id: string; title: string; updatedAt: string };

export type AgentAction = "options" | "forward" | "converge";

export type AgentResult = { map: PMap; summary: string; added: string[] };
