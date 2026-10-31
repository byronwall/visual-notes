import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import { CLEANUP_BUCKETS, type CleanupBucket } from "~/server/cleanup/buckets";
import {
  bucketCounts,
  cleanupItem,
  queueFor,
  noteCleanupHint,
  type CleanupItemDetail,
  type NoteCleanupHint,
  type QueueRow,
} from "~/server/cleanup/queue";
import { resolveProvider } from "~/server/cleanup/assess";
import { regroupCount, regroupQueue } from "~/server/cleanup/regroup-queue";
import { dailyStack, type DailyStack } from "~/server/cleanup/daily";
import { cleanupStatus, type CleanupStatus } from "~/server/cleanup/status";
import { RAIL_BUCKETS } from "~/components/cleanup/cleanup-buckets";

export type CleanupOverview = {
  counts: Record<string, number>;
  archived: number;
  assessed: number;
  provider: string | null;
};

export const fetchCleanupOverview = query(
  async (): Promise<CleanupOverview> => {
    "use server";
    const [counts, regroup, archived, assessed] = await Promise.all([
      bucketCounts(),
      regroupCount(),
      prisma.doc.count({ where: { archivedAt: { not: null } } }),
      prisma.noteAssessment.count(),
    ]);
    return {
      counts: { ...counts, regroup },
      archived,
      assessed,
      provider: resolveProvider(),
    };
  },
  "cleanup-overview",
);

export type CleanupQueue = { bucket: string; total: number; rows: QueueRow[] };

/**
 * A bucket's rows. With no bucket asked for it picks the first one with
 * notes, so the browser doesn't wait for the counts before it asks.
 */
export const fetchCleanupQueue = query(
  async (requested: string): Promise<CleanupQueue> => {
    "use server";
    const counts = await bucketCounts();
    // Regroup is the slow count, so ask only when this queue needs it.
    const needsRegroup = requested === "regroup" || (!requested && !counts.distill);
    if (needsRegroup) counts.regroup = await regroupCount();
    const bucket = (RAIL_BUCKETS as string[]).includes(requested)
      ? requested
      : RAIL_BUCKETS.find((b) => (counts[b] ?? 0) > 0) ?? RAIL_BUCKETS[0];
    const rows =
      bucket === "regroup"
        ? await regroupQueue()
        : CLEANUP_BUCKETS.includes(bucket as CleanupBucket)
          ? await queueFor(bucket as CleanupBucket)
          : [];
    return { bucket, total: counts[bucket] ?? 0, rows };
  },
  "cleanup-queue",
);

export const fetchCleanupItem = query(
  async (docId: string, bucket?: string): Promise<CleanupItemDetail | null> => {
    "use server";
    return docId ? cleanupItem(docId, bucket) : null;
  },
  "cleanup-item",
);

export const fetchNoteCleanupHint = query(
  async (docId: string): Promise<NoteCleanupHint | null> => {
    "use server";
    return docId ? noteCleanupHint(docId) : null;
  },
  "cleanup-note-hint",
);

export const fetchCleanupDaily = query(async (): Promise<DailyStack> => {
  "use server";
  return dailyStack();
}, "cleanup-daily");

export const fetchCleanupStatus = query(async (): Promise<CleanupStatus> => {
  "use server";
  return cleanupStatus();
}, "cleanup-status");
