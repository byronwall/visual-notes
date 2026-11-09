import { prisma } from "~/server/db";
import {
  logActionEvent,
  type LogActionEventInput,
} from "~/server/events/action-events";
import type { AnnotationView } from "~/lib/annotations/types";
import {
  BODY_MAX,
  publishTarget,
  toAnnotationView,
  withMessages,
} from "./annotations";
import { AnnotationError } from "./errors";

// Requests are annotations whose type is For AI. Their life:
//   open → claimed by an agent → ready for review → closed by you.
// Your reply on a ready or closed request opens it again. A claim with no
// agent reply for a day lapses, so another agent can take the request.

export const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;

const claimExpired = (claimedAt: Date | null, now = new Date()) =>
  !claimedAt || now.getTime() - claimedAt.getTime() > CLAIM_TTL_MS;

async function loadRequest(id: string) {
  const row = await prisma.annotation.findUnique({ where: { id } });
  if (!row) throw new AnnotationError(`No request ${id}`);
  if (!row.status) throw new AnnotationError(`${id} is an annotation, not a request (its type is not For AI)`);
  return row;
}

/** The note title or task text, so the activity line names the place. */
async function titleOf(row: { docId: string | null; taskId: string | null }) {
  if (row.taskId) {
    const task = await prisma.taskItem.findUnique({ where: { id: row.taskId }, select: { description: true } });
    return task?.description ?? null;
  }
  if (!row.docId) return null;
  const doc = await prisma.doc.findUnique({ where: { id: row.docId }, select: { title: true } });
  return doc?.title ?? null;
}

const logRequest = async (
  eventType: string,
  row: { id: string; docId: string | null; taskId: string | null },
  payload: Record<string, string | boolean | null>,
  context?: LogActionEventInput["context"],
) =>
  logActionEvent({
    eventType,
    entityType: row.taskId ? "task" : "doc",
    entityId: row.taskId ?? row.docId,
    relatedDocId: row.docId,
    payload: { annotationId: row.id, title: await titleOf(row), ...payload },
    context,
  });

/** Adds a reply. Yours reopens a ready or closed request; an agent's can mark it ready. */
export async function replyToRequest(input: {
  id: string;
  body: string;
  author: string;
  ready?: boolean;
  context?: LogActionEventInput["context"];
}): Promise<AnnotationView> {
  const body = input.body.trim().slice(0, BODY_MAX);
  if (!body) throw new AnnotationError("A reply needs text");
  const current = await loadRequest(input.id);
  const fromYou = input.author === "you";
  if (!fromYou && current.status === "closed") {
    throw new AnnotationError("This request is closed. The user reopens it by replying.");
  }
  const now = new Date();
  const status = fromYou
    ? current.status === "ready" || current.status === "closed"
      ? "open"
      : current.status
    : input.ready
      ? "ready"
      : current.status === "open"
        ? "claimed"
        : current.status;
  const row = await prisma.annotation.update({
    where: { id: input.id },
    data: {
      status,
      messages: { create: { author: input.author, body } },
      ...(fromYou && status === "open" ? { claimedBy: null, claimedAt: null, readyAt: null, closedAt: null } : {}),
      ...(!fromYou
        ? {
            lastAgentAt: now,
            claimedBy: current.claimedBy ?? input.author,
            claimedAt: current.claimedAt ?? now,
            ...(input.ready ? { readyAt: now } : {}),
          }
        : {}),
    },
    include: withMessages,
  });
  await logRequest(
    input.ready ? "annotation.request_ready" : "annotation.reply",
    row,
    { body: body.slice(0, 160), status },
    input.context,
  );
  publishTarget(row);
  return toAnnotationView(row);
}

export async function closeRequest(id: string): Promise<AnnotationView> {
  await loadRequest(id);
  const row = await prisma.annotation.update({
    where: { id },
    data: { status: "closed", closedAt: new Date(), seenAt: new Date() },
    include: withMessages,
  });
  await logRequest("annotation.request_closed", row, {});
  publishTarget(row);
  return toAnnotationView(row);
}

/**
 * Claims an open request for one agent. Only one claim wins: the update is
 * conditional on the request still being open, or its claim having lapsed.
 */
export async function claimRequest(input: {
  id: string;
  agent: string;
  context?: LogActionEventInput["context"];
}): Promise<AnnotationView> {
  const current = await loadRequest(input.id);
  const now = new Date();
  const lapsed = new Date(now.getTime() - CLAIM_TTL_MS);
  const result = await prisma.annotation.updateMany({
    where: {
      id: input.id,
      OR: [
        { status: "open" },
        { status: "claimed", claimedBy: input.agent },
        { status: "claimed", claimedAt: { lt: lapsed } },
      ],
    },
    data: { status: "claimed", claimedBy: input.agent, claimedAt: now },
  });
  if (result.count === 0) {
    const fresh = await loadRequest(input.id);
    if (fresh.status === "claimed") {
      throw new AnnotationError(
        `Already claimed by ${fresh.claimedBy} at ${fresh.claimedAt?.toISOString()}. Skip it; the claim lapses after 24 hours without a reply.`,
      );
    }
    throw new AnnotationError(`This request is ${fresh.status}, so it cannot be claimed.`);
  }
  const row = await prisma.annotation.findUniqueOrThrow({ where: { id: input.id }, include: withMessages });
  if (current.claimedBy !== input.agent) {
    await logRequest("annotation.request_claimed", row, { agent: input.agent }, input.context);
  }
  publishTarget(row);
  return toAnnotationView(row);
}

/** Refuses a request id an agent cannot answer, before anything is written. */
export async function assertAnswerable(id: string) {
  const row = await loadRequest(id);
  if (row.status === "closed") throw new AnnotationError("This request is closed. The user reopens it by replying.");
}

/** Records agent work on a request (an annotation or a proposal) as activity. */
export async function touchRequestByAgent(id: string, agent: string) {
  const current = await loadRequest(id);
  const now = new Date();
  await prisma.annotation.update({
    where: { id },
    data: {
      lastAgentAt: now,
      ...(current.status === "open" || (current.status === "claimed" && claimExpired(current.claimedAt, now))
        ? { status: "claimed", claimedBy: agent, claimedAt: now }
        : {}),
    },
  });
}

export async function listTaskAnnotations(taskId: string): Promise<AnnotationView[]> {
  const rows = await prisma.annotation.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    include: withMessages,
  });
  return rows.map(toAnnotationView);
}

export { claimExpired };
