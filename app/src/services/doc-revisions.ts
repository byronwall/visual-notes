import { action, json, query } from "@solidjs/router";
import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import {
  listNoteRevisions,
  restoreNoteRevision,
  type NoteRevision,
} from "~/server/notes/note-revisions";
import { fetchDoc } from "./docs.queries";

export type DocRevisionItem = NoteRevision;

export type DocRevisionsInfo = {
  savedByChatGpt: boolean;
  revisions: DocRevisionItem[];
};

export const fetchDocRevisions = query(
  async (docId: string): Promise<DocRevisionsInfo> => {
    "use server";
    const [doc, revisions] = await Promise.all([
      prisma.doc.findUnique({
        where: { id: docId },
        select: { originalSource: true },
      }),
      listNoteRevisions(docId),
    ]);
    return {
      savedByChatGpt: doc?.originalSource === "chatgpt",
      revisions,
    };
  },
  "doc-revisions",
);

/**
 * Puts a previous version back. The current content is snapshotted first,
 * so a restore can itself be undone.
 */
export const restoreDocRevision = action(async (revisionId: string) => {
  "use server";
  const { docId } = await restoreNoteRevision(revisionId, "magic_user");
  await logActionEvent({
    eventType: "doc.update",
    entityType: "doc",
    entityId: docId,
    relatedDocId: docId,
    payload: { restoredRevisionId: revisionId, reason: "restore" },
  });
  return json(
    { ok: true, docId },
    {
      revalidate: [fetchDocRevisions.keyFor(docId), fetchDoc.keyFor(docId)],
    },
  );
}, "doc-revision-restore");
