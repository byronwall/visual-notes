import { prisma } from "~/server/db";
import { claimExpired } from "./requests";

// What a polling agent reads: every open or claimed request with the
// context to act on it, plus open research comments. `since` narrows it to
// what changed after the last poll.

const LIMIT = 50;

export type InboxLinks = {
  note: (id: string) => string;
  tasks: (listId: string) => string;
  research: (slug: string) => string;
};

export async function readAgentInbox(input: { since?: Date; links: InboxLinks }) {
  const now = new Date();
  const since = input.since;
  const requests = await prisma.annotation.findMany({
    where: {
      status: { in: ["open", "claimed"] },
      ...(since ? { updatedAt: { gt: since } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: LIMIT,
    include: {
      type: true,
      messages: { orderBy: { createdAt: "asc" } },
      doc: { select: { id: true, title: true, path: true } },
      task: { select: { id: true, description: true, listId: true, list: { select: { name: true } } } },
    },
  });

  // Other annotations on the same notes, of every type, as context.
  const docIds = [...new Set(requests.map((r) => r.docId).filter((id): id is string => Boolean(id)))];
  const nearby = docIds.length
    ? await prisma.annotation.findMany({
        where: { docId: { in: docIds } },
        include: { type: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const comments = await prisma.researchComment.findMany({
    where: { resolvedAt: null, ...(since ? { createdAt: { gt: since } } : {}) },
    orderBy: { createdAt: "asc" },
    take: LIMIT,
    include: {
      topic: { select: { title: true, slug: true } },
      card: { select: { id: true, title: true } },
    },
  });

  return {
    requests: requests.map((r) => ({
      id: r.id,
      status: r.status,
      claimedBy: r.claimedBy,
      claimable: r.status === "open" || claimExpired(r.claimedAt, now),
      type: r.type.name,
      ask: r.body,
      createdAt: r.createdAt.toISOString(),
      on: r.taskId ? "task" : r.blockId ? "passage" : "note",
      ...(r.doc
        ? {
            noteId: r.doc.id,
            noteTitle: r.doc.title,
            notePath: r.doc.path,
            appUrl: input.links.note(r.doc.id) + (r.blockId ? `#b-${r.blockId}` : ""),
          }
        : {}),
      ...(r.blockId
        ? {
            blockId: r.blockId,
            ...(r.endBlockId ? { endBlockId: r.endBlockId } : {}),
            passage: r.quote,
            passageRemoved: r.detachedAt !== null,
          }
        : {}),
      ...(r.task
        ? {
            taskId: r.task.id,
            task: r.task.description,
            listId: r.task.listId,
            listName: r.task.list.name,
            appUrl: input.links.tasks(r.task.listId),
          }
        : {}),
      thread: r.messages.map((m) => ({ from: m.author, text: m.body, at: m.createdAt.toISOString() })),
      otherAnnotations: nearby
        .filter((a) => a.docId === r.docId && a.id !== r.id)
        .map((a) => ({
          id: a.id,
          type: a.type.name,
          forAi: a.type.forAi,
          from: a.author,
          passage: a.quote,
          text: a.body,
        })),
    })),
    researchComments: comments.map((c) => ({
      id: c.id,
      topicSlug: c.topic.slug,
      topicTitle: c.topic.title,
      cardId: c.card?.id ?? null,
      cardTitle: c.card?.title ?? null,
      text: c.body,
      createdAt: c.createdAt.toISOString(),
      appUrl: input.links.research(c.topic.slug),
    })),
    truncated: requests.length === LIMIT || comments.length === LIMIT,
    pollSince: now.toISOString(),
  };
}
