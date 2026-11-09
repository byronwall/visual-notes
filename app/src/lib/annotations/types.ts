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

/** Palette tokens an annotation type can use. */
export const ANNOTATION_COLORS = ["amber", "green", "blue", "red", "gray"] as const;
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number];

export type AnnotationTypeView = {
  id: string;
  name: string;
  color: AnnotationColor;
  forAi: boolean;
  isDefault: boolean;
  builtIn: string | null;
};

export type AnnotationView = {
  id: string;
  docId: string | null;
  typeId: string;
  body: string;
  author: string;
  blockId: string | null;
  quote: string | null;
  quoteStart: number | null;
  detached: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Where a passage annotation sits now, as the editor last saw it. */
export type AnchorUpdate = {
  id: string;
  blockId: string;
  quote: string;
  quoteStart: number;
  detached: boolean;
};
