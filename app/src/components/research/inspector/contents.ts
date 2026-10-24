import type { ResearchCard, ResearchCardType } from "~/services/research/research.types";
import { sectionByType } from "../layout/sections";

export type ContentsSection = { key: "open" | "closed" | ResearchCardType; cards: ResearchCard[] };

const tokensOf = (query: string) => query.trim().toLowerCase().split(/\s+/).filter(Boolean);

/** Every query token appears in the title, body, snippet, or URL. */
export const cardMatches = (card: ResearchCard, query: string) => {
  const tokens = tokensOf(query);
  if (!tokens.length) return true;
  const haystack = `${card.title}\n${card.body}\n${card.snippet ?? ""}\n${card.url ?? ""}`.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
};

/** Ids of matching cards, or null when there is no query (everything matches). */
export const matchingIds = (cards: ResearchCard[], query: string): Set<string> | null =>
  tokensOf(query).length ? new Set(cards.filter((card) => cardMatches(card, query)).map((card) => card.id)) : null;

/**
 * One line of body text around the first token the title does not show, so a
 * body-only match explains itself. Null when the title already matches.
 */
export const bodyExcerpt = (card: ResearchCard, query: string, radius = 48): string | null => {
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
 * Contents order: the open frontier first, then each type, then finished work.
 * Every card appears in exactly one section.
 */
export const contentsSections = (cards: ResearchCard[], order: Map<string, number>): ContentsSection[] => {
  const sorted = [...cards].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const open = sorted.filter((card) => card.state === "open");
  const closed = sorted.filter((card) => card.state === "done" || card.state === "dropped");
  const rest = sorted.filter((card) => card.state === null);
  return [
    { key: "open" as const, cards: open },
    ...sectionByType(rest, (card) => card.type).map((section) => ({ key: section.type, cards: section.items })),
    { key: "closed" as const, cards: closed },
  ].filter((section) => section.cards.length > 0);
};

/** Outline (pre-order) position of every card, so lists read in tree order; summaries go last. */
export const treeOrder = (children: Map<string | null, ResearchCard[]>, cards: ResearchCard[]) => {
  const order = new Map<string, number>();
  const walk = (parentId: string | null) => {
    for (const card of children.get(parentId) ?? []) {
      if (order.has(card.id)) continue;
      order.set(card.id, order.size);
      walk(card.id);
    }
  };
  walk(null);
  for (const card of cards) if (!order.has(card.id)) order.set(card.id, order.size);
  return order;
};
