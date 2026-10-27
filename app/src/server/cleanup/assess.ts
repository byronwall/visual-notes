import type { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import { serverEnv } from "~/env/server";
import { noteMarkdown } from "~/server/notes/note-store";
import { bucketFor } from "./buckets";
import {
  createJevDecider,
  createOpenaiDecider,
  type Decider,
  type DecisionProvider,
} from "./decide";
import { heuristicDecider } from "./heuristic";
import { checkLink } from "./link-check";
import { buildNoteState } from "./note-state";
import { assessPlacement, assessStalePairs } from "./regroup";
import {
  NOTE_QUESTIONS,
  OWNER_PROFILE,
  QUESTION_SET_VERSION,
} from "./questions";

const LOG_PREFIX = "[cleanup-assess]";
/** Jev handles ~8 concurrent requests comfortably. */
const CONCURRENCY = 6;

/**
 * Which decision provider to use. `CLEANUP_DECIDER` picks one explicitly
 * (`off` disables assessment); otherwise Jev runs when its key is set.
 */
export function resolveProvider(): DecisionProvider | null {
  const choice = serverEnv.CLEANUP_DECIDER?.trim().toLowerCase();
  if (choice === "off") return null;
  if (choice === "heuristic") return "heuristic";
  if (choice === "openai") {
    return serverEnv.OPENAI_API_KEY?.trim() ? "openai" : null;
  }
  return serverEnv.TYPESAFE_API_KEY?.trim() ? "jev" : null;
}

export function deciderFor(provider: DecisionProvider): Decider {
  if (provider === "jev") return createJevDecider(serverEnv.TYPESAFE_API_KEY!);
  if (provider === "openai") {
    return createOpenaiDecider(serverEnv.OPENAI_API_KEY!);
  }
  return heuristicDecider;
}

/**
 * Notes whose assessment is missing or stale: content changed since, or the
 * question set moved on. Collection rows, events, and places are never
 * cleanup candidates; their value is the structured record. Archived notes
 * are already handled.
 */
export async function staleDocIds(limit: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT d.id
    FROM "Doc" d
    LEFT JOIN "NoteAssessment" a ON a."docId" = d.id
    WHERE d."collectionId" IS NULL
      AND d."archivedAt" IS NULL
      AND NOT EXISTS (SELECT 1 FROM "Event" e WHERE e."docId" = d.id)
      AND NOT EXISTS (SELECT 1 FROM "Place" p WHERE p."docId" = d.id)
      AND (
        a.id IS NULL
        OR a."contentVersion" <> d."contentVersion"
        OR a."questionSetVersion" <> ${QUESTION_SET_VERSION}
        -- A recording was added or transcribed since, or the count is unknown.
        OR EXISTS (
          SELECT 1 FROM "DocAudio" x
          WHERE x."docId" = d.id
            AND (
              a.facts->'recordings' IS NULL
              OR x."createdAt" > a."updatedAt"
              OR x."transcribedAt" > a."updatedAt"
            )
        )
        -- A recording was moved in or out (moves keep their timestamps).
        OR (a.facts->>'recordings')::int <> (
          SELECT count(*) FROM "DocAudio" x WHERE x."docId" = d.id
        )
        -- A dead link may come back: check it again each day until decided.
        OR (
          a.facts->'link'->>'status' = 'dead'
          AND a."decision" IS NULL
          AND a."updatedAt" < now() - interval '1 day'
        )
      )
    ORDER BY d."updatedAt" DESC
    LIMIT ${limit}`;
  return rows.map((row) => row.id);
}

async function createdByAgent(docId: string): Promise<boolean> {
  const created = await prisma.actionEvent.findFirst({
    where: { relatedDocId: docId, eventType: "doc.create" },
    select: { actorType: true },
  });
  return created?.actorType === "chatgpt";
}

/** Asks the question set about one note and stores the answers. */
export async function assessDoc(
  docId: string,
  decide: Decider,
  today = new Date(),
): Promise<void> {
  const doc = await prisma.doc.findUnique({
    where: { id: docId },
    select: {
      id: true,
      title: true,
      path: true,
      createdAt: true,
      contentVersion: true,
      content: true,
      markdown: true,
      html: true,
      originalSource: true,
      audioText: true,
      activitySnapshot: { select: { views30d: true } },
      _count: { select: { audioRecordings: true } },
    },
  });
  if (!doc) return;
  const state = buildNoteState(
    {
      title: doc.title,
      path: doc.path,
      createdAt: doc.createdAt,
      markdown: noteMarkdown(doc),
      originalSource: doc.originalSource,
      createdByAgent: await createdByAgent(doc.id),
      views30d: doc.activitySnapshot?.views30d ?? 0,
      recordings: doc._count.audioRecordings,
      audioText: doc.audioText,
    },
    today,
  );
  // Breadcrumb links: check the link once per content version, so a dead
  // one can go to delete and a live one to revisit_link.
  if (state.facts.linkUrl) {
    state.facts.link = await checkLink(state.facts.linkUrl);
  }
  const result = await decide({
    owner: OWNER_PROFILE,
    state,
    questions: NOTE_QUESTIONS,
  });
  const { bucket, confidence } = bucketFor(state.facts, result.answers);
  const data = {
    contentVersion: doc.contentVersion,
    questionSetVersion: QUESTION_SET_VERSION,
    model: result.model,
    facts: state.facts as unknown as Prisma.InputJsonValue,
    answers: result.answers as unknown as Prisma.InputJsonValue,
    bucket,
    confidence,
    inputTokens: result.inputTokens,
    latencyMs: result.latencyMs,
  };
  await prisma.noteAssessment.upsert({
    where: { docId: doc.id },
    create: { docId: doc.id, ...data },
    update: data,
  });
  // Regroup: an unfiled note may belong in an existing path or collection.
  if (!doc.path) await assessPlacement(doc.id, state.note, decide);
}

/** The pair pass for regroup, with the configured provider. */
export async function assessStalePairsNow(limit: number) {
  const provider = resolveProvider();
  if (!provider) return { checked: 0, asked: 0 };
  return assessStalePairs(limit, deciderFor(provider));
}

/** Assesses up to `limit` stale notes; returns how many were assessed. */
export async function assessStaleNotes(limit: number): Promise<{
  provider: DecisionProvider | null;
  assessed: number;
  failed: number;
}> {
  const provider = resolveProvider();
  if (!provider) return { provider, assessed: 0, failed: 0 };
  const decide = deciderFor(provider);
  const ids = await staleDocIds(limit);
  let assessed = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((id) => assessDoc(id, decide)),
    );
    for (const [index, r] of results.entries()) {
      if (r.status === "fulfilled") assessed += 1;
      else {
        failed += 1;
        console.warn(`${LOG_PREFIX} failed doc=${batch[index]}`, r.reason);
      }
    }
  }
  if (ids.length) {
    console.info(
      `${LOG_PREFIX} provider=${provider} assessed=${assessed} failed=${failed}`,
    );
  }
  return { provider, assessed, failed };
}
