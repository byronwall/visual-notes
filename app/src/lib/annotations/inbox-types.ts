import type { AnnotationView, EditProposalView } from "./types";

/** Where an inbox item lives, for its link and title. */
export type InboxPlace =
  | { kind: "note"; docId: string; title: string; blockId: string | null }
  | { kind: "task"; taskId: string; listId: string; title: string };

/** Why an item needs you, most urgent first. */
export type NeedsYouReason =
  | "ready"
  | "agent-reply"
  | "agent-note"
  | "proposal"
  | "research";

export type InboxItem =
  | {
      reason: Exclude<NeedsYouReason, "proposal" | "research">;
      at: string;
      place: InboxPlace;
      typeName: string;
      color: string;
      annotation: AnnotationView;
    }
  | { reason: "proposal"; at: string; place: InboxPlace; proposal: EditProposalView }
  | {
      reason: "research";
      at: string;
      commentId: string;
      topicSlug: string;
      topicTitle: string;
      cardTitle: string | null;
      body: string;
      resolution: string | null;
    };

export type WaitingItem = {
  at: string;
  place: InboxPlace;
  typeName: string;
  color: string;
  annotation: AnnotationView;
};

/** Consecutive MCP calls by one agent, shown as one line. */
export type AgentRun = {
  agent: string;
  start: string;
  end: string;
  calls: number;
  writes: number;
  problems: number;
  /** Busiest tools first. */
  tools: { tool: string; calls: number }[];
};

export type UserInbox = {
  /** Server time of the read, so SSR and hydration format times the same. */
  generatedAt: string;
  needsYou: InboxItem[];
  waiting: WaitingItem[];
  runs: AgentRun[];
};
