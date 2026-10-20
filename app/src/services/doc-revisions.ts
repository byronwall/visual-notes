import { action, json, query } from "@solidjs/router";
import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import { contentFromLegacy } from "~/lib/note-content/convert";
import { rebuildNoteIndex } from "~/server/notes/note-index";
import { contentColumns, revisionSnapshot } from "~/server/notes/note-store";
import { fetchDoc } from "./docs.queries";

export type DocRevisionItem = {
  id: string;
  createdAt: string;
  reason: string;
  actorType: string;
  title: string;
  path: string | null;
};

export type DocRevisionsInfo = {
  savedByChatGpt: boolean;
  revisions: DocRevisionItem[];
};

const REVISION_LIMIT = 50;

export const fetchDocRevisions = query(
  async (docId: string): Promise<DocRevisionsInfo> => {
    "use server";
    const [doc, revisions] = await Promise.all([
      prisma.doc.findUnique({
        where: { id: docId },
        select: { originalSource: true },
      }),
      prisma.docRevision.findMany({
        where: { docId },
        orderBy: { createdAt: "desc" },
        take: REVISION_LIMIT,
        select: {
          id: true,
          createdAt: true,
          reason: true,
          actorType: true,
          title: true,
          path: true,
        },
      }),
    ]);
    return {
      savedByChatGpt: doc?.originalSource === "chatgpt",
      revisions: revisions.map((revision) => ({
        ...revision,
        createdAt: revision.createdAt.toISOString(),
      })),
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
  const revision = await prisma.docRevision.findUnique({
    where: { id: revisionId },
  });
  if (!revision) throw new Error("Version not found");
  const current = await prisma.doc.findUnique({
    where: { id: revision.docId },
    select: {
      title: true,
      path: true,
      markdown: true,
      html: true,
      content: true,
    },
  });
  if (!current) throw new Error("Note not found");
  const restoredDoc = contentFromLegacy(revision);
  const restored = contentColumns(restoredDoc);

  await prisma.$transaction(async (tx) => {
    await tx.docRevision.create({
      data: {
        docId: revision.docId,
        ...revisionSnapshot(current),
        actorType: "magic_user",
        reason: "restore",
      },
    });
    await tx.doc.update({
      where: { id: revision.docId },
      data: {
        title: revision.title,
        path: revision.path,
        ...restored,
        contentVersion: { increment: 1 },
      },
    });
    await rebuildNoteIndex(tx, revision.docId, restoredDoc);
  });
  await logActionEvent({
    eventType: "doc.update",
    entityType: "doc",
    entityId: revision.docId,
    relatedDocId: revision.docId,
    payload: { restoredRevisionId: revision.id, reason: "restore" },
  });
  return json(
    { ok: true, docId: revision.docId },
    {
      revalidate: [
        fetchDocRevisions.keyFor(revision.docId),
        fetchDoc.keyFor(revision.docId),
      ],
    },
  );
}, "doc-revision-restore");
