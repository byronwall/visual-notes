import { prisma } from "~/server/db";
import { serverEnv } from "~/env/server";
import { countStaleDocs, resolveProvider } from "./assess";
import { sweepStatus } from "./assessment-sweep";
import { DISTILL_MODEL } from "./distill";
import { countStalePairs } from "./regroup";

/** The rail's answer to "am I paying right now, and how much so far?" */

const WEEK_MS = 7 * 24 * 60 * 60_000;

export type SpendWindow = { calls: number; tokens: number };

export type CleanupStatus = {
  provider: string | null;
  /** The sweep's decision model bills per call (not local rules or off). */
  sweepPaid: boolean;
  running: boolean;
  runningCause: string | null;
  lastRunAt: string | null;
  pendingNotes: number;
  pendingPairs: number;
  today: SpendWindow;
  week: SpendWindow;
};

/** Which explicit actions on a note spend money, and on what model. */
export type PaidActions = { draft: boolean; link: boolean; model: string };

export const isPaidProvider = (provider: string | null) =>
  provider === "jev" || provider === "openai";

export function paidActions(): PaidActions {
  const draft = Boolean(serverEnv.OPENAI_API_KEY?.trim());
  return {
    draft,
    link: draft || isPaidProvider(resolveProvider()),
    model: DISTILL_MODEL,
  };
}

async function spendSince(since: Date): Promise<SpendWindow> {
  const row = await prisma.llmRequest.aggregate({
    where: { createdAt: { gte: since } },
    _count: { _all: true },
    _sum: { totalTokens: true },
  });
  return { calls: row._count._all, tokens: row._sum.totalTokens ?? 0 };
}

/** Sweep state is per process, so a restart falls back to the call log. */
async function lastRunAt(finishedAt: Date | null): Promise<Date | null> {
  if (finishedAt) return finishedAt;
  const last = await prisma.llmRequest.findFirst({
    where: { trigger: { startsWith: "sweep:" } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return last?.createdAt ?? null;
}

export async function cleanupStatus(now = new Date()): Promise<CleanupStatus> {
  const sweep = sweepStatus();
  const provider = resolveProvider();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const [pendingNotes, pendingPairs, today, week, last] = await Promise.all([
    countStaleDocs(),
    countStalePairs(),
    spendSince(startOfDay),
    spendSince(new Date(now.getTime() - WEEK_MS)),
    lastRunAt(sweep.finishedAt),
  ]);
  return {
    provider,
    sweepPaid: isPaidProvider(provider),
    running: sweep.running,
    runningCause: sweep.running ? sweep.cause : null,
    lastRunAt: last?.toISOString() ?? null,
    pendingNotes,
    pendingPairs,
    today,
    week,
  };
}
