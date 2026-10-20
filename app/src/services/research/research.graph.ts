import type {
  ResearchCard,
  ResearchSummaryGroup,
  ResearchTopicGraph,
} from "./research.types";

export const isOpenCard = (card: Pick<ResearchCard, "state">) => card.state === "open";

export const countOpen = (cards: Pick<ResearchCard, "state">[]) => cards.filter(isOpenCard).length;

/**
 * The topic's headline summary: the accepted summary that is not itself
 * covered by another accepted summary and covers the most cards.
 */
export const pickTopSummary = (
  cards: Pick<ResearchCard, "id" | "title" | "body">[],
  groups: ResearchSummaryGroup[],
): { title: string; body: string } | null => {
  const accepted = groups.filter((group) => group.status === "accepted");
  if (!accepted.length) return null;
  const covered = new Set(accepted.flatMap((group) => group.memberIds));
  const top = accepted
    .filter((group) => !covered.has(group.summaryCardId))
    .sort((a, b) => b.memberIds.length - a.memberIds.length)[0];
  const card = top && cards.find((candidate) => candidate.id === top.summaryCardId);
  return card ? { title: card.title, body: card.body } : null;
};

/** Children by came-from parent, ordered by sortOrder then creation. */
export const groupChildren = (cards: ResearchCard[]) => {
  const byParent = new Map<string | null, ResearchCard[]>();
  const ids = new Set(cards.map((card) => card.id));
  for (const card of cards) {
    if (card.type === "summary") continue;
    // A parent that is hidden or missing makes the card a root here.
    const key = card.parentId && ids.has(card.parentId) ? card.parentId : null;
    const list = byParent.get(key) ?? [];
    list.push(card);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  }
  return byParent;
};

/** Open cards in pre-order with their came-from chain (root first). */
export const listFrontier = (graph: Pick<ResearchTopicGraph, "cards">) => {
  const children = groupChildren(graph.cards);
  const out: { card: ResearchCard; pedigree: ResearchCard[] }[] = [];
  const walk = (parentId: string | null, chain: ResearchCard[]) => {
    for (const card of children.get(parentId) ?? []) {
      if (isOpenCard(card)) out.push({ card, pedigree: chain });
      walk(card.id, [...chain, card]);
    }
  };
  walk(null, []);
  return out;
};

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "topic";
