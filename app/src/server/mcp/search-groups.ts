import { prisma } from "~/server/db";
import { searchArchivedPages } from "~/server/archive/archive-store";
import { queryTasks } from "~/server/tasks/task-store";
import { archivePageUrl } from "./archive-tools";
import { noteUrl, type ConnectorContext } from "./notes-shared";

// The other kinds `search` can include beside notes, each matched by plain
// words (case-insensitive) and returned as its own labeled group.

export const SEARCH_KINDS = ["research", "tasks", "archive"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

async function searchResearchCards(
  ctx: ConnectorContext,
  text: string,
  limit: number,
) {
  const contains = { contains: text, mode: "insensitive" as const };
  const cards = await prisma.researchCard.findMany({
    where: {
      hiddenAt: null,
      OR: [
        { title: contains },
        { body: contains },
        { snippet: contains },
        { url: contains },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      state: true,
      url: true,
      snippet: true,
      body: true,
      topic: {
        select: { id: true, slug: true, title: true, archivedAt: true },
      },
    },
  });
  return cards.map((card) => ({
    cardId: card.id,
    type: card.type,
    title: card.title,
    state: card.state,
    snippet: (card.snippet || card.body).slice(0, 240) || null,
    sourceUrl: card.url,
    topic: {
      id: card.topic.id,
      title: card.topic.title,
      archived: Boolean(card.topic.archivedAt),
    },
    url: `${ctx.origin}/research/${card.topic.slug}`,
  }));
}

async function searchTasks(ctx: ConnectorContext, text: string, limit: number) {
  const rows = await queryTasks({ text, limit });
  return rows.map((task) => ({
    id: task.id,
    description: task.description,
    status: task.status,
    list: task.list.name,
    dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
    note: task.sourceDocId
      ? {
          id: task.sourceDocId,
          title: task.sourceDoc?.title ?? null,
          url: noteUrl(ctx, task.sourceDocId),
        }
      : null,
  }));
}

async function searchArchive(
  ctx: ConnectorContext,
  text: string,
  limit: number,
) {
  const pages = await searchArchivedPages({ text, limit });
  return pages.map((page) => ({
    ...page,
    appUrl: archivePageUrl(ctx, page.id),
  }));
}

/** One group per requested kind, keyed by kind. */
export async function searchOtherKinds(
  ctx: ConnectorContext,
  input: { query: string; include: SearchKind[]; limit: number },
): Promise<Partial<Record<SearchKind, unknown[]>>> {
  const text = input.query.trim();
  const run: Record<SearchKind, () => Promise<unknown[]>> = {
    research: () => searchResearchCards(ctx, text, input.limit),
    tasks: () => searchTasks(ctx, text, input.limit),
    archive: () => searchArchive(ctx, text, input.limit),
  };
  const kinds = Array.from(new Set(input.include));
  const groups = await Promise.all(kinds.map((kind) => run[kind]()));
  return Object.fromEntries(kinds.map((kind, i) => [kind, groups[i]]));
}
