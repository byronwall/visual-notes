import type { ActionActorType, Prisma } from "@prisma/client";
import { normalizeNoteDoc } from "~/lib/note-content/convert";
import { mergeTopLevel } from "~/lib/note-content/merge";
import type { NoteDoc } from "~/lib/note-content/types";
import { rebuildNoteIndex } from "./note-index";
import { contentColumns, readNoteContent, revisionSnapshot } from "./note-store";

type Tx = Prisma.TransactionClient;

export type ContentWrite = {
  docId: string;
  doc: NoteDoc;
  /** contentVersion the writer started from; omit to overwrite. */
  baseVersion?: number;
  /** Top-level block hashes at baseVersion, for the three-way merge. */
  baseHashes?: Record<string, string>;
  actorType: ActionActorType;
  /** Other column updates applied in the same write (title, path, …). */
  extra?: Prisma.DocUpdateInput;
};

export type ContentWriteResult = {
  id: string;
  updatedAt: Date;
  contentVersion: number;
  /** Set when the write was merged with newer stored content. */
  merged: NoteDoc | null;
  conflicts: string[];
};

type LockedRow = {
  contentVersion: number;
  content: unknown;
  html: string;
  markdown: string;
  title: string;
  path: string | null;
};

/**
 * Writes note content under a row lock. When the writer's base version is
 * stale, its blocks are merged with the stored ones; on a same-block
 * conflict the incoming version wins and the stored version is kept as a
 * `merge-conflict` revision. The block index is rebuilt in the same
 * transaction.
 */
export async function writeNoteContent(
  tx: Tx,
  input: ContentWrite,
): Promise<ContentWriteResult> {
  const [current] = await tx.$queryRaw<LockedRow[]>`
    SELECT "contentVersion", "content", "html", "markdown", "title", "path"
    FROM "Doc" WHERE "id" = ${input.docId} FOR UPDATE`;
  if (!current) throw new Error("Not found");

  let doc = input.doc;
  let merged: NoteDoc | null = null;
  let conflicts: string[] = [];
  const stale =
    input.baseVersion !== undefined &&
    input.baseHashes !== undefined &&
    current.contentVersion !== input.baseVersion;
  if (stale) {
    const result = mergeTopLevel({
      baseHashes: input.baseHashes!,
      mine: input.doc,
      theirs: readNoteContent(current),
    });
    doc = normalizeNoteDoc(result.doc);
    merged = doc;
    conflicts = result.conflicts;
    console.info(
      "[note-write] merged doc:%s base:%d stored:%d conflicts:%d",
      input.docId,
      input.baseVersion,
      current.contentVersion,
      conflicts.length,
    );
    if (conflicts.length) {
      await tx.docRevision.create({
        data: {
          docId: input.docId,
          ...revisionSnapshot(current),
          actorType: input.actorType,
          reason: "merge-conflict",
        },
      });
    }
  }

  const row = await tx.doc.update({
    where: { id: input.docId },
    data: {
      ...input.extra,
      ...contentColumns(doc),
      contentVersion: { increment: 1 },
    },
    select: { id: true, updatedAt: true, contentVersion: true },
  });
  await rebuildNoteIndex(tx, input.docId, doc);
  return { ...row, merged, conflicts };
}
