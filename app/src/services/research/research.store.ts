import { prisma } from "~/server/db";
import { countOpen, pickTopSummary, slugify } from "./research.graph";
import type {
  ResearchCard,
  ResearchTopicGraph,
  ResearchTopicListItem,
} from "./research.types";

// Server-only topic reads/writes shared by UI queries, actions, and MCP tools.

const iso = (value: Date | null) => (value ? value.toISOString() : null);

export const createTopic = async (input: { title: string; slug?: string }) => {
  const title = input.title.trim();
  const base = slugify(input.slug?.trim() || title);
  let slug = base;
  for (let attempt = 2; await prisma.researchTopic.findUnique({ where: { slug } }); attempt++) {
    slug = `${base}-${attempt}`;
  }
  return prisma.researchTopic.create({ data: { title, slug }, select: { id: true, slug: true, title: true } });
};

export const resolveTopic = async (idOrSlug: string) =>
  prisma.researchTopic.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, slug: true, title: true, archivedAt: true },
  });

/** A topic's batch by id or batchKey, however old. */
export const findBatch = (topicId: string, idOrKey: string) =>
  prisma.researchBatch.findFirst({
    where: { topicId, OR: [{ id: idOrKey }, { batchKey: idOrKey }] },
    select: { id: true },
  });

export const loadTopicGraph = async (idOrSlug: string): Promise<ResearchTopicGraph | null> => {
  const topic = await resolveTopic(idOrSlug);
  if (!topic) return null;
  const [cards, links, groups, batches] = await Promise.all([
    prisma.researchCard.findMany({
      where: { topicId: topic.id, hiddenAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.researchLink.findMany({
      where: { topicId: topic.id, hiddenAt: null },
      select: { id: true, fromId: true, toId: true, kind: true },
    }),
    prisma.researchSummaryGroup.findMany({
      where: { topicId: topic.id, summaryCard: { hiddenAt: null } },
      select: {
        id: true,
        summaryCardId: true,
        status: true,
        members: { where: { card: { hiddenAt: null } }, select: { cardId: true } },
      },
    }),
    prisma.researchBatch.findMany({
      where: { topicId: topic.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { cards: true } } },
    }),
  ]);

  return {
    topic: { id: topic.id, slug: topic.slug, title: topic.title, archivedAt: iso(topic.archivedAt) },
    cards: cards.map(
      (card): ResearchCard => ({
        id: card.id,
        type: card.type,
        title: card.title,
        body: card.body,
        state: card.state,
        url: card.url,
        snippet: card.snippet,
        imageUrl: card.imageUrl,
        parentId: card.parentId,
        sortOrder: card.sortOrder,
        nudgeX: card.nudgeX,
        nudgeY: card.nudgeY,
        batchId: card.batchId,
        createdAt: card.createdAt.toISOString(),
        updatedAt: card.updatedAt.toISOString(),
      }),
    ),
    links,
    groups: groups.map((group) => ({
      id: group.id,
      summaryCardId: group.summaryCardId,
      status: group.status,
      memberIds: group.members.map((member) => member.cardId),
    })),
    batches: batches.map((batch) => ({
      id: batch.id,
      batchKey: batch.batchKey,
      agent: batch.agent,
      summary: batch.summary,
      cardCount: batch._count.cards,
      createdAt: batch.createdAt.toISOString(),
      undoneAt: iso(batch.undoneAt),
    })),
    generatedAt: new Date().toISOString(),
  };
};

export const listTopics = async (opts: { includeArchived?: boolean } = {}): Promise<ResearchTopicListItem[]> => {
  const topics = await prisma.researchTopic.findMany({
    where: opts.includeArchived ? {} : { archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      archivedAt: true,
      updatedAt: true,
      cards: {
        where: { hiddenAt: null },
        select: { id: true, type: true, title: true, body: true, state: true, updatedAt: true },
      },
      groups: {
        where: { status: "accepted", summaryCard: { hiddenAt: null } },
        select: {
          id: true,
          summaryCardId: true,
          status: true,
          members: { where: { card: { hiddenAt: null } }, select: { cardId: true } },
        },
      },
    },
  });

  return topics.map((topic) => {
    const lastCard = topic.cards.reduce<Date>(
      (latest, card) => (card.updatedAt > latest ? card.updatedAt : latest),
      topic.updatedAt,
    );
    const top = pickTopSummary(
      topic.cards,
      topic.groups.map((group) => ({ ...group, memberIds: group.members.map((m) => m.cardId) })),
    );
    return {
      id: topic.id,
      slug: topic.slug,
      title: topic.title,
      topSummary: top ? top.body || top.title : null,
      cardCount: topic.cards.filter((card) => card.type !== "summary").length,
      openCount: countOpen(topic.cards),
      lastActivityAt: lastCard.toISOString(),
      archivedAt: iso(topic.archivedAt),
    };
  });
};
