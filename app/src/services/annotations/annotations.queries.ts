import { query } from "@solidjs/router";
import type { EditProposalView } from "~/lib/annotations/types";

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
