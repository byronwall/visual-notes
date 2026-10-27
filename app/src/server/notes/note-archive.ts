import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import {
  ARCHIVE_RETENTION_DAYS,
  DAY_MS,
  type ArchiveReason,
} from "./archive-window";
import { refreshDocAudioText } from "./doc-audio-transcribe";

/**
 * The cleanup archive. Archiving hides a note from lists and search but keeps
 * it openable by id; after the retention window the purge deletes it and
 * leaves a `DocTombstone`, so old links still lead somewhere. `archivedInto`
 * records where the content went (a distilled or combined note); links to the
 * archived note open that note instead.
 */

const LOG_PREFIX = "[note-archive]";

export async function archiveNotes(input: {
  docIds: string[];
  intoId?: string | null;
  reason: ArchiveReason;
}): Promise<number> {
  const ids = input.docIds.filter((id) => id && id !== input.intoId);
  if (!ids.length) return 0;
  const result = await prisma.doc.updateMany({
    where: { id: { in: ids }, archivedAt: null },
    data: {
      archivedAt: new Date(),
      archivedIntoId: input.intoId ?? null,
      archiveReason: input.reason,
    },
  });
  // The purge deletes an archived note's recordings with it. When the
  // content went into another note, move the recordings there too.
  if (input.intoId) {
    const moved = await prisma.docAudio.updateMany({
      where: { docId: { in: ids } },
      data: { docId: input.intoId },
    });
    if (moved.count) {
      await refreshDocAudioText(input.intoId);
      for (const id of ids) await refreshDocAudioText(id);
      console.info(
        `${LOG_PREFIX} moved %d recordings into %s`,
        moved.count,
        input.intoId,
      );
    }
  }
  for (const id of ids) {
    await logActionEvent({
      eventType: "doc.archive",
      entityType: "doc",
      entityId: id,
      relatedDocId: id,
      payload: { reason: input.reason, intoId: input.intoId ?? null },
    });
  }
  return result.count;
}

export async function restoreNote(docId: string): Promise<boolean> {
  const result = await prisma.doc.updateMany({
    where: { id: docId, archivedAt: { not: null } },
    data: { archivedAt: null, archivedIntoId: null, archiveReason: null },
  });
  if (result.count) {
    await logActionEvent({
      eventType: "doc.restore",
      entityType: "doc",
      entityId: docId,
      relatedDocId: docId,
    });
  }
  return result.count > 0;
}

/**
 * Deletes notes archived longer than the retention window, leaving a
 * tombstone for each. Notes that pointed into a purged note are re-pointed to
 * where that note's own content went, so redirect chains survive.
 */
export async function purgeExpiredArchive(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ARCHIVE_RETENTION_DAYS * DAY_MS);
  const expired = await prisma.doc.findMany({
    where: { archivedAt: { lt: cutoff } },
    select: {
      id: true,
      title: true,
      path: true,
      archivedAt: true,
      archiveReason: true,
      archivedIntoId: true,
    },
    take: 200,
  });
  for (const doc of expired) {
    await prisma.$transaction([
      prisma.docTombstone.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          title: doc.title,
          path: doc.path,
          archivedAt: doc.archivedAt!,
          archiveReason: doc.archiveReason,
          redirectDocId: doc.archivedIntoId,
        },
        update: { deletedAt: now, redirectDocId: doc.archivedIntoId },
      }),
      prisma.doc.updateMany({
        where: { archivedIntoId: doc.id },
        data: { archivedIntoId: doc.archivedIntoId },
      }),
      prisma.docTombstone.updateMany({
        where: { redirectDocId: doc.id },
        data: { redirectDocId: doc.archivedIntoId },
      }),
      prisma.doc.delete({ where: { id: doc.id } }),
    ]);
    await logActionEvent({
      eventType: "doc.delete",
      entityType: "doc",
      entityId: doc.id,
      payload: { reason: "archive_expired" },
    });
  }
  if (expired.length) {
    console.info(`${LOG_PREFIX} purged ${expired.length} archived notes`);
  }
  return expired.length;
}

const PURGE_TIMER_KEY = Symbol.for("visual-notes.archive-purge");
const PURGE_INTERVAL_MS = 6 * 60 * 60_000;
type PurgeGlobal = typeof globalThis & {
  [PURGE_TIMER_KEY]?: ReturnType<typeof setInterval>;
};

async function runPurge() {
  try {
    while ((await purgeExpiredArchive()) === 200) {
      // Keep going until a short batch says the backlog is clear.
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} purge failed`, error);
  }
}

/** One purge after boot, then every six hours. Skips in tests. */
export function startArchivePurge(): void {
  if (process.env.NODE_ENV === "test") return;
  const store = globalThis as PurgeGlobal;
  const previous = store[PURGE_TIMER_KEY];
  if (previous) clearInterval(previous);
  const timer = setInterval(() => void runPurge(), PURGE_INTERVAL_MS);
  (timer as { unref?: () => void }).unref?.();
  store[PURGE_TIMER_KEY] = timer;
  if (!previous) void runPurge();
}
