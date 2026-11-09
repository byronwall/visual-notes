import type { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import { publishAppChange } from "~/server/note-events";
import { readNoteContent } from "~/server/notes/note-store";
import { AnnotationError } from "./errors";
import type { LogActionEventInput } from "~/server/events/action-events";
import { blockHash } from "~/lib/annotations/block-hash";
import type { NoteDoc, NoteNode } from "~/lib/note-content/types";
import type {
  EditProposalView,
  ProposalOp,
  ProposalOpState,
} from "~/lib/annotations/types";

// Agents propose block edits to any note; the user accepts them in the
// editor. Nothing here writes the note body.

const LOG_PREFIX = "[proposals]";
export const SUMMARY_MAX = 500;


export type ProposedEdit = {
  op: ProposalOp["op"];
  blockId: string;
  blocks?: NoteNode[];
};

/** Every id-bearing block in the note, keyed by id. */
function blocksById(doc: NoteDoc): Map<string, NoteNode> {
  const out = new Map<string, NoteNode>();
  const visit = (node: NoteNode) => {
    const id = node.attrs?.id;
    if (typeof id === "string" && id) out.set(id, node);
    node.content?.forEach(visit);
  };
  visit(doc);
  return out;
}

export async function createProposal(input: {
  docId: string;
  author: string;
  summary?: string;
  edits: ProposedEdit[];
  context?: LogActionEventInput["context"];
}): Promise<EditProposalView> {
  if (input.edits.length === 0) throw new AnnotationError("edits must not be empty");
  const doc = await prisma.doc.findUnique({
    where: { id: input.docId },
    select: { id: true, title: true, content: true, html: true, markdown: true },
  });
  if (!doc) throw new AnnotationError(`No note with id ${input.docId}`);
  const byId = blocksById(readNoteContent(doc));
  const ops: ProposalOp[] = input.edits.map((edit) => {
    const target = byId.get(edit.blockId);
    if (!target) {
      const valid = [...byId.keys()].slice(0, 60).join(", ");
      throw new AnnotationError(
        `Unknown block id ${edit.blockId}. Call notes_get again for current ids. Valid ids: ${valid}`,
      );
    }
    if (edit.op !== "delete" && !edit.blocks?.length) {
      throw new AnnotationError(`${edit.op} on ${edit.blockId} needs markdown`);
    }
    return {
      op: edit.op,
      blockId: edit.blockId,
      ...(edit.op === "delete" ? {} : { blocks: edit.blocks }),
      baseHash: blockHash(target),
      state: "pending",
    };
  });
  const row = await prisma.editProposal.create({
    data: {
      docId: doc.id,
      author: input.author,
      summary: input.summary?.trim().slice(0, SUMMARY_MAX) || null,
      ops: ops as unknown as Prisma.InputJsonValue,
    },
  });
  console.info(`${LOG_PREFIX} proposed`, { docId: doc.id, ops: ops.length });
  await logActionEvent({
    eventType: "annotation.propose",
    entityType: "doc",
    entityId: doc.id,
    relatedDocId: doc.id,
    payload: { proposalId: row.id, ops: ops.length, docTitle: doc.title },
    context: input.context,
  });
  publishAppChange("inbox", [doc.id]);
  return toView(row);
}

type ProposalRow = {
  id: string;
  docId: string;
  author: string;
  summary: string | null;
  createdAt: Date;
  ops: Prisma.JsonValue;
};

export const toView = (row: ProposalRow): EditProposalView => ({
  id: row.id,
  docId: row.docId,
  author: row.author,
  summary: row.summary,
  createdAt: row.createdAt.toISOString(),
  ops: row.ops as unknown as ProposalOp[],
});

/** Proposals on a note that still have a pending op, oldest first. */
export async function listOpenProposals(
  docId: string,
): Promise<EditProposalView[]> {
  const rows = await prisma.editProposal.findMany({
    where: { docId, resolvedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toView);
}

/**
 * Marks ops accepted or rejected. Accepting only records the decision: the
 * editor has already applied the blocks, and autosave writes them.
 */
export async function resolveProposalOps(input: {
  proposalId: string;
  indexes: number[];
  state: Exclude<ProposalOpState, "pending">;
}): Promise<EditProposalView> {
  const updated = await prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ ops: Prisma.JsonValue }[]>`
      SELECT "ops" FROM "EditProposal" WHERE "id" = ${input.proposalId} FOR UPDATE`;
    if (!locked) throw new AnnotationError(`No proposal ${input.proposalId}`);
    const ops = locked.ops as unknown as ProposalOp[];
    for (const index of input.indexes) {
      const op = ops[index];
      if (!op) throw new AnnotationError(`No op ${index} in this proposal`);
      if (op.state === "pending") op.state = input.state;
    }
    const open = ops.some((op) => op.state === "pending");
    return tx.editProposal.update({
      where: { id: input.proposalId },
      data: {
        ops: ops as unknown as Prisma.InputJsonValue,
        resolvedAt: open ? null : new Date(),
      },
    });
  });
  await logActionEvent({
    eventType: `annotation.proposal_${input.state}`,
    entityType: "doc",
    entityId: updated.docId,
    relatedDocId: updated.docId,
    payload: { proposalId: updated.id, ops: input.indexes.length },
  });
  publishAppChange("inbox", [updated.docId]);
  return toView(updated);
}
