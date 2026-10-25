import type { ResearchCard } from "~/services/research/research.types";
import type { BoardModel } from "../board/board-model";

/** One stream (or the topic's criteria) in Contents, in board order. */
export type ContentsSection = {
  key: string;
  label: string;
  cards: ResearchCard[];
};

const tokensOf = (query: string) =>
  query.trim().toLowerCase().split(/\s+/).filter(Boolean);

/** Every query token appears in the title, body, snippet, or URL. */
export const cardMatches = (card: ResearchCard, query: string) => {
  const tokens = tokensOf(query);
  if (!tokens.length) return true;
  const haystack =
    `${card.title}\n${card.gist}\n${card.body}\n${card.snippet ?? ""}\n${card.url ?? ""}`.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
};

/** Ids of matching cards, or null when there is no query (everything matches). */
export const matchingIds = (
  cards: ResearchCard[],
  query: string,
): Set<string> | null =>
  tokensOf(query).length
    ? new Set(
        cards.filter((card) => cardMatches(card, query)).map((card) => card.id),
      )
    : null;

/**
 * One line of body text around the first token the title does not show, so a
 * body-only match explains itself. Null when the title already matches.
 */
export const bodyExcerpt = (
  card: ResearchCard,
  query: string,
  radius = 48,
): string | null => {
  const tokens = tokensOf(query);
  const title = card.title.toLowerCase();
  const missing = tokens.find((token) => !title.includes(token));
  if (!missing) return null;
  const text = `${card.body} ${card.snippet ?? ""}`
    .replace(/[#>*_`~[\]()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const at = text.toLowerCase().indexOf(missing);
  if (at < 0) return null;
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + missing.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
};

/**
 * Contents mirrors the board: topic criteria, then each stream's cards in
 * board order with its cited sources after them. Every card appears once.
 */
export const contentsSections = (
  board: BoardModel,
  cards: ResearchCard[],
  keep: (card: ResearchCard) => boolean = () => true,
): ContentsSection[] => {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const placed = new Set<string>();
  const take = (ids: string[]) =>
    ids.flatMap((id) => {
      const card = byId.get(id);
      if (!card || placed.has(id)) return [];
      placed.add(id);
      return keep(card) ? [card] : [];
    });
  const sections: ContentsSection[] = [
    {
      key: "criteria",
      label: "Criteria",
      cards: take(board.topicCriteria.map((card) => card.id)),
    },
  ];
  for (const model of board.columns) {
    const cited = model.order.flatMap((id) =>
      (board.relations.citations.get(id) ?? []).map((source) => source.id),
    );
    sections.push({
      key: model.column.id,
      label: model.column.title,
      cards: take([...model.order, ...cited]),
    });
  }
  const rest = cards.filter((card) => !placed.has(card.id));
  if (rest.length)
    sections.push({
      key: "other",
      label: "Other",
      cards: take(rest.map((card) => card.id)),
    });
  return sections.filter((section) => section.cards.length > 0);
};

/** Outline (pre-order) position of every card, so lists read in tree order; summaries go last. */
export const treeOrder = (
  children: Map<string | null, ResearchCard[]>,
  cards: ResearchCard[],
) => {
  const order = new Map<string, number>();
  const walk = (parentId: string | null) => {
    for (const card of children.get(parentId) ?? []) {
      if (order.has(card.id)) continue;
      order.set(card.id, order.size);
      walk(card.id);
    }
  };
  walk(null);
  for (const card of cards)
    if (!order.has(card.id)) order.set(card.id, order.size);
  return order;
};
