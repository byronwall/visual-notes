import { prisma } from "~/server/db";
import { queueFor, type QueueItem } from "./queue";
import { regroupQueue } from "./regroup-queue";

/**
 * The daily stack: a small quota of the strongest suggestions across every
 * bucket, interleaved so one bucket doesn't fill the day.
 */

export const DAILY_QUOTA = 8;
const UPCOMING = 3;

export type DailyStack = {
  quota: number;
  doneToday: number;
  /** Today's remaining cards, then a few upcoming ones. */
  items: QueueItem[];
  remaining: number;
  openTotal: number;
};

/** Round-robin across buckets, each bucket in confidence order. */
export function interleave(groups: QueueItem[][]): QueueItem[] {
  const queues = groups.filter((g) => g.length).map((g) => [...g]);
  queues.sort((a, b) => b[0].confidence - a[0].confidence);
  const out: QueueItem[] = [];
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
  const [doneToday, distill, postEvent, makeTask, links, del, regroup] =
    await Promise.all([
      prisma.noteAssessment.count({
        where: { decidedAt: { gte: startOfDay } },
      }),
      queueFor("distill"),
      queueFor("post_event"),
      queueFor("make_task"),
      queueFor("revisit_link"),
      queueFor("delete"),
      regroupQueue(),
    ]);
  const all = interleave([distill, regroup, postEvent, makeTask, links, del]);
  const remaining = Math.max(0, Math.min(all.length, DAILY_QUOTA - doneToday));
  return {
    quota: DAILY_QUOTA,
    doneToday,
    remaining,
    openTotal: all.length,
    items: all.slice(0, remaining + UPCOMING),
  };
}
