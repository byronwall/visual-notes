import { query } from "@solidjs/router";
import type {
  AnnotationTypeView,
  AnnotationView,
  EditProposalView,
} from "~/lib/annotations/types";
import type { UserInbox } from "~/lib/annotations/inbox-types";

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

export const fetchTaskAnnotations = query(
  async (taskId: string): Promise<AnnotationView[]> => {
    "use server";
    const { agentInboxEnabled } = await import("~/server/annotations/switch");
    if (!taskId || !agentInboxEnabled()) return [];
    const { listTaskAnnotations } = await import("~/server/annotations/requests");
    return listTaskAnnotations(taskId);
  },
  "annotations-task",
);


export const fetchUserInbox = query(async (): Promise<UserInbox | null> => {
  "use server";
  const { agentInboxEnabled } = await import("~/server/annotations/switch");
  if (!agentInboxEnabled()) return null;
  const { loadUserInbox } = await import("~/server/annotations/user-inbox");
  return loadUserInbox();
}, "inbox-full");

export const fetchInboxCount = query(async (): Promise<number> => {
  "use server";
  const { agentInboxEnabled } = await import("~/server/annotations/switch");
  if (!agentInboxEnabled()) return 0;
  const { countNeedsYou } = await import("~/server/annotations/user-inbox");
  return countNeedsYou();
}, "inbox-count");
