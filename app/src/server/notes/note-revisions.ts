import type { ActionActorType } from "@prisma/client";
import { prisma } from "~/server/db";
import { contentFromLegacy } from "~/lib/note-content/convert";
import { revisionSnapshot } from "./note-store";
import { writeNoteContent } from "./note-write";

// Version history shared by the note page (services/doc-revisions.ts) and the
// MCP connector. A restore snapshots the current version first, so it can
// itself be undone.

export type NoteRevision = {
  id: string;
  createdAt: string;
  reason: string;
  actorType: string;
  title: string;
  path: string | null;
};

export const REVISION_LIMIT = 50;

export async function listNoteRevisions(
  docId: string,
  limit = REVISION_LIMIT,
): Promise<NoteRevision[]> {
  const rows = await prisma.docRevision.findMany({
    where: { docId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      reason: true,
      actorType: true,
      title: true,
      path: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

export class RevisionNotFoundError extends Error {}

/** Puts revision `revisionId` back as the note's title, path, and body. */
export async function restoreNoteRevision(
  revisionId: string,
  actorType: ActionActorType,
): Promise<{ docId: string; title: string; path: string | null }> {
  const revision = await prisma.docRevision.findUnique({
    where: { id: revisionId },
  });
  if (!revision) throw new RevisionNotFoundError("Version not found");
  await prisma.$transaction(async (tx) => {
    const current = await tx.doc.findUnique({
      where: { id: revision.docId },
      select: {
        title: true,
        path: true,
        markdown: true,
        html: true,
        content: true,
      },
    });
    if (!current) throw new RevisionNotFoundError("Note not found");
    await tx.docRevision.create({
      data: {
        docId: revision.docId,
        ...revisionSnapshot(current),
        actorType,
        reason: "restore",
      },
    });
    await writeNoteContent(tx, {
      docId: revision.docId,
      doc: contentFromLegacy(revision),
      actorType,
      extra: { title: revision.title, path: revision.path },
    });
  });
  return { docId: revision.docId, title: revision.title, path: revision.path };
}
