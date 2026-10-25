import type { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import { noteMarkdown } from "~/server/notes/note-store";
import type { CleanupBucket } from "./buckets";
import type { Answers } from "./decide";
import type { NoteFacts } from "./note-state";
import { signalsFor, type Signal } from "./signals";

/** Reads for the triage page: bucket counts, a bucket's queue, one item. */

const KEEP_SNOOZE_MONTHS = 6;
const QUEUE_LIMIT = 300;

/** Assessments that should show: live note, not snoozed, not acted on. */
export const openAssessmentWhere = (
  now = new Date(),
): Prisma.NoteAssessmentWhereInput => ({
  doc: { archivedAt: null },
  // A bare NOT on a nullable column would also drop rows with no decision.
  AND: [
    { OR: [{ decision: null }, { decision: { not: "done" } }] },
    { OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }] },
  ],
});

export type QueueItem = {
  docId: string;
  title: string;
  path: string | null;
  bucket: string;
  confidence: number;
  source: NoteFacts["source"];
  created: string;
  words: number;
  model: string;
  signals: Signal[];
};

export async function bucketCounts(): Promise<Record<string, number>> {
  const groups = await prisma.noteAssessment.groupBy({
    by: ["bucket"],
    where: openAssessmentWhere(),
    _count: { _all: true },
  });
  return Object.fromEntries(groups.map((g) => [g.bucket, g._count._all]));
}

const itemSelect = {
  docId: true,
  bucket: true,
  confidence: true,
  model: true,
  facts: true,
  answers: true,
  doc: { select: { title: true, path: true } },
} satisfies Prisma.NoteAssessmentSelect;

type ItemRow = Prisma.NoteAssessmentGetPayload<{ select: typeof itemSelect }>;

function toItem(row: ItemRow): QueueItem {
  const facts = row.facts as unknown as NoteFacts;
  const answers = row.answers as unknown as Answers;
  return {
    docId: row.docId,
    title: row.doc.title,
    path: row.doc.path,
    bucket: row.bucket,
    confidence: row.confidence,
    source: facts.source,
    created: facts.created,
    words: facts.words,
    model: row.model,
    signals: signalsFor(row.bucket, facts, answers),
  };
}

export async function queueFor(bucket: CleanupBucket): Promise<QueueItem[]> {
  const rows = await prisma.noteAssessment.findMany({
    where: { ...openAssessmentWhere(), bucket },
    orderBy: { confidence: "desc" },
    take: QUEUE_LIMIT,
    select: itemSelect,
  });
  return rows.map(toItem);
}

export type DestinationOption = {
  docId: string;
  title: string;
  path: string | null;
};

export type CleanupItemDetail = QueueItem & {
  markdown: string;
  /** Existing notes that could take the result, best first. */
  destinations: DestinationOption[];
};

/**
 * Notes in the same path that cleanup isn't trying to remove, as places to
 * send distilled content. Most recently edited first.
 */
async function destinationsFor(
  docId: string,
  path: string | null,
): Promise<DestinationOption[]> {
  if (!path) return [];
  const parent = path.split(".")[0];
  return prisma.doc
    .findMany({
      where: {
        id: { not: docId },
        archivedAt: null,
        collectionId: null,
        OR: [
          { path },
          { path: parent },
          { path: { startsWith: `${parent}.` } },
        ],
        NOT: {
          cleanupAssessment: {
            is: {
              bucket: { in: ["distill", "delete", "post_event", "make_task"] },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { id: true, title: true, path: true },
    })
    .then((rows) =>
      rows.map((r) => ({ docId: r.id, title: r.title, path: r.path })),
    );
}

export async function cleanupItem(
  docId: string,
): Promise<CleanupItemDetail | null> {
  const row = await prisma.noteAssessment.findUnique({
    where: { docId },
    select: {
      ...itemSelect,
      doc: {
        select: {
          title: true,
          path: true,
          markdown: true,
          html: true,
          content: true,
        },
      },
    },
  });
  if (!row) return null;
  return {
    ...toItem(row),
    markdown: noteMarkdown(row.doc),
    destinations: await destinationsFor(docId, row.doc.path),
  };
}

/** Keep as is: out of the queues for six months, then asked again. */
export async function keepNote(docId: string, now = new Date()) {
  const until = new Date(now);
  until.setMonth(until.getMonth() + KEEP_SNOOZE_MONTHS);
  await prisma.noteAssessment.update({
    where: { docId },
    data: { decision: "keep", decidedAt: now, snoozedUntil: until },
  });
}

const SNOOZE_DAYS = 30;

/** Not now: out of the queues and the note chip for 30 days. */
export async function snoozeNote(docId: string, now = new Date()) {
  const until = new Date(now.getTime() + SNOOZE_DAYS * 24 * 60 * 60_000);
  await prisma.noteAssessment.update({
    where: { docId },
    data: { decision: "snooze", decidedAt: now, snoozedUntil: until },
  });
}

export type NoteCleanupHint = {
  bucket: string;
  confidence: number;
  signals: Signal[];
};

/** The open suggestion for one note, if cleanup has one for it. */
export async function noteCleanupHint(
  docId: string,
): Promise<NoteCleanupHint | null> {
  const row = await prisma.noteAssessment.findFirst({
    where: { ...openAssessmentWhere(), docId, bucket: { not: "keep" } },
    select: itemSelect,
  });
  if (!row) return null;
  const item = toItem(row);
  return {
    bucket: item.bucket,
    confidence: item.confidence,
    signals: item.signals,
  };
}
