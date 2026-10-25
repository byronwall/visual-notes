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
  type QueueItem,
} from "~/server/cleanup/queue";
import { resolveProvider } from "~/server/cleanup/assess";
import { regroupQueue } from "~/server/cleanup/regroup-queue";
import { dailyStack, type DailyStack } from "~/server/cleanup/daily";

export type CleanupOverview = {
  counts: Record<string, number>;
  archived: number;
  assessed: number;
  provider: string | null;
};

export const fetchCleanupOverview = query(
  async (): Promise<CleanupOverview> => {
    "use server";
    const [counts, archived, assessed, regroup] = await Promise.all([
      bucketCounts(),
      prisma.doc.count({ where: { archivedAt: { not: null } } }),
      prisma.noteAssessment.count(),
      regroupQueue(),
    ]);
    return {
      counts: { ...counts, regroup: regroup.length },
      archived,
      assessed,
      provider: resolveProvider(),
    };
  },
  "cleanup-overview",
);

export const fetchCleanupQueue = query(
  async (bucket: string): Promise<QueueItem[]> => {
    "use server";
    if (bucket === "regroup") return regroupQueue();
    if (!CLEANUP_BUCKETS.includes(bucket as CleanupBucket)) return [];
    return queueFor(bucket as CleanupBucket);
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
