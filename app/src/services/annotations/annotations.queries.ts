import { query } from "@solidjs/router";
import type {
  AnnotationTypeView,
  AnnotationView,
  EditProposalView,
} from "~/lib/annotations/types";

export const fetchNoteProposals = query(
  async (docId: string): Promise<EditProposalView[]> => {
    "use server";
    const { agentInboxEnabled } = await import("~/server/annotations/switch");
    if (!docId || !agentInboxEnabled()) return [];
    const { listOpenProposals } = await import("~/server/annotations/proposals");
    return listOpenProposals(docId);
  },
  "annotations-proposals",
);

export const fetchAnnotationTypes = query(
  async (): Promise<AnnotationTypeView[]> => {
    "use server";
    const { listAnnotationTypes } = await import("~/server/annotations/annotation-types");
    return listAnnotationTypes();
  },
  "annotations-types",
);

export const fetchNoteAnnotations = query(
  async (docId: string): Promise<AnnotationView[]> => {
    "use server";
    const { agentInboxEnabled } = await import("~/server/annotations/switch");
    if (!docId || !agentInboxEnabled()) return [];
    const { listNoteAnnotations } = await import("~/server/annotations/annotations");
    return listNoteAnnotations(docId);
  },
  "annotations-note",
);
