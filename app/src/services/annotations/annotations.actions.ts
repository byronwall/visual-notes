import { action } from "@solidjs/router";
import { z } from "zod";
import type { AnchorUpdate } from "~/lib/annotations/types";

export const resolveProposal = action(
  async (payload: {
    proposalId: string;
    indexes: number[];
    state: "accepted" | "rejected";
  }) => {
    "use server";
    const input = z
      .object({
        proposalId: z.string().min(1),
        indexes: z.array(z.number().int().min(0)).min(1),
        state: z.enum(["accepted", "rejected"]),
      })
      .parse(payload);
    const { resolveProposalOps } = await import(
      "~/server/annotations/proposals"
    );
    return resolveProposalOps(input);
  },
  "annotations-resolve-proposal",
);

const id = z.string().min(1);

export const createNoteAnnotation = action(
  async (payload: {
    docId: string;
    typeId?: string;
    body?: string;
    blockId?: string | null;
    quote?: string | null;
    quoteStart?: number | null;
    endBlockId?: string | null;
    endOffset?: number | null;
  }) => {
    "use server";
    const input = z
      .object({
        docId: id,
        typeId: id.optional(),
        body: z.string().max(4000).optional(),
        blockId: id.nullable().optional(),
        quote: z.string().max(4000).nullable().optional(),
        quoteStart: z.number().int().min(0).nullable().optional(),
        endBlockId: id.nullable().optional(),
        endOffset: z.number().int().min(0).nullable().optional(),
      })
      .parse(payload);
    const { createAnnotation } = await import("~/server/annotations/annotations");
    return createAnnotation(input);
  },
  "annotations-create",
);

export const updateNoteAnnotation = action(
  async (payload: { id: string; body?: string; typeId?: string }) => {
    "use server";
    const input = z
      .object({ id, body: z.string().max(4000).optional(), typeId: id.optional() })
      .parse(payload);
    const { updateAnnotation } = await import("~/server/annotations/annotations");
    return updateAnnotation(input);
  },
  "annotations-update",
);

export const deleteNoteAnnotation = action(async (annotationId: string) => {
  "use server";
  const { deleteAnnotation } = await import("~/server/annotations/annotations");
  await deleteAnnotation(id.parse(annotationId));
  return { ok: true };
}, "annotations-delete");

export const saveAnnotationAnchors = action(
  async (payload: { docId: string; updates: AnchorUpdate[] }) => {
    "use server";
    const input = z
      .object({
        docId: id,
        updates: z.array(
          z.object({
            id,
            blockId: id,
            quote: z.string().max(4000),
            quoteStart: z.number().int().min(0),
            endBlockId: id.nullable(),
            endOffset: z.number().int().min(0).nullable(),
            detached: z.boolean(),
          }),
        ),
      })
      .parse(payload);
    const { saveAnchors } = await import("~/server/annotations/annotations");
    return saveAnchors(input.docId, input.updates);
  },
  "annotations-save-anchors",
);

export const createAnnotationTypeAction = action(
  async (payload: { name: string; color: string; forAi: boolean }) => {
    "use server";
    const input = z
      .object({ name: z.string().min(1).max(40), color: z.string(), forAi: z.boolean() })
      .parse(payload);
    const { createAnnotationType } = await import("~/server/annotations/annotation-types");
    return createAnnotationType(input);
  },
  "annotations-type-create",
);

export const updateAnnotationTypeAction = action(
  async (payload: { id: string; name?: string; color?: string; forAi?: boolean; isDefault?: boolean }) => {
    "use server";
    const input = z
      .object({
        id,
        name: z.string().min(1).max(40).optional(),
        color: z.string().optional(),
        forAi: z.boolean().optional(),
        isDefault: z.boolean().optional(),
      })
      .parse(payload);
    const { updateAnnotationType } = await import("~/server/annotations/annotation-types");
    return updateAnnotationType(input);
  },
  "annotations-type-update",
);

export const deleteAnnotationTypeAction = action(async (typeId: string) => {
  "use server";
  const { deleteAnnotationType } = await import("~/server/annotations/annotation-types");
  await deleteAnnotationType(id.parse(typeId));
  return { ok: true };
}, "annotations-type-delete");

/** Note to AI: a whole-note (or task) request with the built-in Request type. */
export const createAiRequest = action(
  async (payload: { docId?: string; taskId?: string; body: string }) => {
    "use server";
    const input = z
      .object({ docId: id.optional(), taskId: id.optional(), body: z.string().trim().min(1).max(4000) })
      .refine((v) => Boolean(v.docId) !== Boolean(v.taskId), "Give a note or a task")
      .parse(payload);
    const { agentInboxEnabled } = await import("~/server/annotations/switch");
    if (!agentInboxEnabled()) throw new Error("The agent inbox is turned off on this server.");
    const { BUILT_IN, builtInTypeId } = await import("~/server/annotations/annotation-types");
    const { createAnnotation } = await import("~/server/annotations/annotations");
    return createAnnotation({
      docId: input.docId,
      taskId: input.taskId,
      body: input.body,
      typeId: await builtInTypeId(BUILT_IN.request),
    });
  },
  "annotations-request-create",
);

export const replyToRequestAction = action(
  async (payload: { id: string; body: string }) => {
    "use server";
    const input = z.object({ id, body: z.string().trim().min(1).max(4000) }).parse(payload);
    const { replyToRequest } = await import("~/server/annotations/requests");
    return replyToRequest({ ...input, author: "you" });
  },
  "annotations-request-reply",
);

export const closeRequestAction = action(async (requestId: string) => {
  "use server";
  const { closeRequest } = await import("~/server/annotations/requests");
  return closeRequest(id.parse(requestId));
}, "annotations-request-close");

export const dismissInboxItemAction = action(
  async (payload: { kind: "annotation" | "research"; id: string }) => {
    "use server";
    const input = z.object({ kind: z.enum(["annotation", "research"]), id }).parse(payload);
    const { dismissInboxItem } = await import("~/server/annotations/user-inbox");
    await dismissInboxItem(input);
    return { ok: true };
  },
  "inbox-dismiss",
);
