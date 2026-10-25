import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import { CLEANUP_BUCKETS, type CleanupBucket } from "~/server/cleanup/buckets";
import {
  bucketCounts,
  cleanupItem,
  queueFor,
  type CleanupItemDetail,
  type QueueItem,
} from "~/server/cleanup/queue";
import { resolveProvider } from "~/server/cleanup/assess";

export type CleanupOverview = {
  counts: Record<string, number>;
  archived: number;
  assessed: number;
  provider: string | null;
};

export const fetchCleanupOverview = query(
  async (): Promise<CleanupOverview> => {
    "use server";
    const [counts, archived, assessed] = await Promise.all([
      bucketCounts(),
      prisma.doc.count({ where: { archivedAt: { not: null } } }),
      prisma.noteAssessment.count(),
    ]);
    return { counts, archived, assessed, provider: resolveProvider() };
  },
  "cleanup-overview",
);

export const fetchCleanupQueue = query(
  async (bucket: string): Promise<QueueItem[]> => {
    "use server";
    if (!CLEANUP_BUCKETS.includes(bucket as CleanupBucket)) return [];
    return queueFor(bucket as CleanupBucket);
  },
  "cleanup-queue",
);

export const fetchCleanupItem = query(
  async (docId: string): Promise<CleanupItemDetail | null> => {
    "use server";
    return docId ? cleanupItem(docId) : null;
  },
  "cleanup-item",
);
