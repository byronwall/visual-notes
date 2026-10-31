import { prisma } from "~/server/db";
import { bucketCounts, queueFor, type QueueRow } from "./queue";
import { regroupCount, regroupQueue } from "./regroup-queue";

/**
 * The daily stack: a small quota of the strongest suggestions across every
 * bucket, interleaved so one bucket doesn't fill the day.
 */

export const DAILY_QUOTA = 8;
const UPCOMING = 3;
const DAILY_BUCKETS = [
  "distill",
  "post_event",
  "make_task",
  "revisit_link",
  "delete",
] as const;

export type DailyStack = {
  quota: number;
  doneToday: number;
  /** Today's remaining cards, then a few upcoming ones. */
  items: QueueRow[];
  remaining: number;
  openTotal: number;
};

/** Round-robin across buckets, each bucket in confidence order. */
export function interleave(groups: QueueRow[][]): QueueRow[] {
  const queues = groups.filter((g) => g.length).map((g) => [...g]);
  queues.sort((a, b) => b[0].confidence - a[0].confidence);
  const out: QueueRow[] = [];
  const seen = new Set<string>();
  while (queues.some((q) => q.length)) {
    for (const q of queues) {
      const next = q.shift();
      if (next && !seen.has(next.docId)) {
        seen.add(next.docId);
        out.push(next);
      }
    }
  }
  return out;
}

export async function dailyStack(now = new Date()): Promise<DailyStack> {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  // No day shows more cards than this, whatever the other buckets hold.
  const take = DAILY_QUOTA + UPCOMING;
  const [doneToday, counts, regrouped, ...queues] = await Promise.all([
    prisma.noteAssessment.count({
      where: { decidedAt: { gte: startOfDay } },
    }),
    bucketCounts(),
    regroupCount(),
    queueFor("distill", take),
    regroupQueue(take),
    queueFor("post_event", take),
    queueFor("make_task", take),
    queueFor("revisit_link", take),
    queueFor("delete", take),
  ]);
  const all = interleave(queues);
  const openTotal =
    regrouped +
    DAILY_BUCKETS.reduce((sum, bucket) => sum + (counts[bucket] ?? 0), 0);
  const remaining = Math.max(0, Math.min(openTotal, DAILY_QUOTA - doneToday));
  return {
    quota: DAILY_QUOTA,
    doneToday,
    remaining,
    openTotal,
    items: all.slice(0, remaining + UPCOMING),
  };
}
