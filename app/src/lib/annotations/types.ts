import type { NoteNode } from "~/lib/note-content/types";

export type ProposalOpState = "pending" | "accepted" | "rejected";

/** One block edit an agent proposed, with the block hash it was based on. */
export type ProposalOp = {
  op: "replace" | "insert_after" | "delete";
  blockId: string;
  /** New blocks for replace / insert_after. */
  blocks?: NoteNode[];
  /** hashNode of the target block when the agent proposed the edit. */
  baseHash: string;
  state: ProposalOpState;
};

export type EditProposalView = {
  id: string;
  docId: string;
  author: string;
  summary: string | null;
  createdAt: string;
  ops: ProposalOp[];
};
