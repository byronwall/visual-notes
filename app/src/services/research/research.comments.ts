import { prisma } from "~/server/db";
import { publishAppChange } from "~/server/note-events";
import { ResearchIngestError } from "./research.ingest";

// Comments are notes to the next agent pass, not content: they are not
// batches and never undo. The agent reads open ones in research_get_topic
// and resolves each with a short note about what it changed.

export const COMMENT_MAX = 4_000;

export const addComment = async (
  topicId: string,
  input: {
    cardId?: string | null;
    streamId?: string | null;
    body: string;
    author?: string;
  },
) => {
  const body = input.body.trim().slice(0, COMMENT_MAX);
  if (!body) throw new ResearchIngestError(["comment is empty"]);
  if (input.cardId) {
    const card = await prisma.researchCard.findFirst({
      where: { id: input.cardId, topicId, hiddenAt: null },
    });
    if (!card)
      throw new ResearchIngestError([
        `no card "${input.cardId}" in this topic`,
      ]);
  }
  if (input.streamId) {
    const stream = await prisma.researchStream.findFirst({
      where: { id: input.streamId, topicId, hiddenAt: null },
    });
    if (!stream)
      throw new ResearchIngestError([
        `no stream "${input.streamId}" in this topic`,
      ]);
  }
  const comment = await prisma.researchComment.create({
    data: {
      topicId,
      cardId: input.cardId ?? null,
      streamId: input.streamId ?? null,
      body,
      author: input.author?.trim() || "you",
    },
  });
  publishAppChange("research", [topicId]);
  return comment;
};

/** Mark comments resolved (or reopen them with resolved: false). */
export const resolveComments = async (
  topicId: string,
  input: { resolutions: { id: string; note?: string }[]; resolved?: boolean },
) => {
  const ids = input.resolutions.map((entry) => entry.id);
  const found = await prisma.researchComment.findMany({
    where: { topicId, id: { in: ids } },
    select: { id: true },
  });
  const known = new Set(found.map((comment) => comment.id));
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length)
    throw new ResearchIngestError(
      missing.map((id) => `no comment "${id}" in this topic`),
    );
  const resolved = input.resolved ?? true;
  await prisma.$transaction(
    input.resolutions.map((entry) =>
      prisma.researchComment.update({
        where: { id: entry.id },
        data: resolved
          ? {
              resolvedAt: new Date(),
              resolution: entry.note?.trim().slice(0, COMMENT_MAX) || null,
            }
          : { resolvedAt: null, resolution: null },
      }),
    ),
  );
  publishAppChange("research", [topicId]);
  return {
    resolved: resolved ? ids.length : 0,
    reopened: resolved ? 0 : ids.length,
  };
};
