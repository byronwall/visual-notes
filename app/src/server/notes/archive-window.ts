import { prisma } from "~/server/db";

/**
 * Read-side helpers for the cleanup archive (see note-archive.ts). Kept free
 * of the event log so note readers can import them cheaply.
 */

export const ARCHIVE_RETENTION_DAYS = 30;
export const DAY_MS = 24 * 60 * 60_000;
const MAX_REDIRECT_HOPS = 8;

export type ArchiveReason =
  | "distill"
  | "combine"
  | "post_event"
  | "make_task"
  | "delete"
  | "manual";

export const deletesAt = (archivedAt: Date) =>
  new Date(archivedAt.getTime() + ARCHIVE_RETENTION_DAYS * DAY_MS);

/**
 * Follows `archivedInto` (and tombstone redirects) from an archived or
 * deleted note to the live note that holds its content, if any.
 */
export async function resolveArchiveRedirect(
  docId: string,
): Promise<{ id: string; title: string } | null> {
  let current = docId;
  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop += 1) {
    const doc = await prisma.doc.findUnique({
      where: { id: current },
      select: { id: true, title: true, archivedAt: true, archivedIntoId: true },
    });
    let next: string | null;
    if (doc) {
      if (!doc.archivedAt)
        return hop === 0 ? null : { id: doc.id, title: doc.title };
      next = doc.archivedIntoId;
    } else {
      const tombstone = await prisma.docTombstone.findUnique({
        where: { id: current },
        select: { redirectDocId: true },
      });
      next = tombstone?.redirectDocId ?? null;
    }
    if (!next || next === current) return null;
    current = next;
  }
  return null;
}
