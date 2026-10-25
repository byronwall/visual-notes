import type {
  ResearchCard,
  ResearchLink,
  ResearchTopicGraph,
} from "./research.types";

// What cards say about each other, from came-from parents and typed links.
// Came-from children imply a relationship by role: a finding under a
// question answers it, a card under a task is its result, a source under a
// finding backs it. Typed links say the same thing across branches.

type Graph = Pick<ResearchTopicGraph, "cards" | "links">;

const EVIDENCE_HOLDERS = new Set<ResearchCard["type"]>([
  "finding",
  "option",
  "criterion",
]);
const WORK_ITEMS = new Set<ResearchCard["type"]>(["question", "task"]);

export type TopicRelations = {
  /** Question (or finding) id → cards that answer or detail it, in card order. */
  answers: Map<string, ResearchCard[]>;
  /** Task id → cards it produced. */
  results: Map<string, ResearchCard[]>;
  /** Option id → open-or-closed questions/tasks that block or bear on it. */
  blockers: Map<
    string,
    { card: ResearchCard; kind: "blocks" | "relates_to" }[]
  >;
  /** Finding/option id → sources that back it. */
  citations: Map<string, ResearchCard[]>;
  /** Source ids that back at least one card (drawn as citations, not cards). */
  citedSources: Set<string>;
  /** Card ids that sit nested under another card on the board. */
  nested: Set<string>;
};

const push = <V>(map: Map<string, V[]>, key: string, value: V) => {
  const list = map.get(key);
  if (list) {
    if (!list.includes(value)) list.push(value);
  } else map.set(key, [value]);
};

/** Card order everywhere: sortOrder, then creation. */
export const byCardOrder = (a: ResearchCard, b: ResearchCard) =>
  a.sortOrder - b.sortOrder ||
  a.createdAt.localeCompare(b.createdAt) ||
  a.id.localeCompare(b.id);

export const buildRelations = (graph: Graph): TopicRelations => {
  const byId = new Map(graph.cards.map((card) => [card.id, card]));
  const answers = new Map<string, ResearchCard[]>();
  const results = new Map<string, ResearchCard[]>();
  const blockers = new Map<
    string,
    { card: ResearchCard; kind: "blocks" | "relates_to" }[]
  >();
  const citations = new Map<string, ResearchCard[]>();
  const nested = new Set<string>();

  const cite = (source: ResearchCard, holder: ResearchCard) => {
    push(citations, holder.id, source);
    nested.add(source.id);
  };

  for (const card of graph.cards) {
    const parent = card.parentId ? byId.get(card.parentId) : undefined;
    if (!parent || card.type === "summary") continue;
    if (card.type === "source" && EVIDENCE_HOLDERS.has(parent.type))
      cite(card, parent);
    else if (
      (parent.type === "question" || parent.type === "finding") &&
      (card.type === "finding" || card.type === "source")
    ) {
      // A finding under a finding is a detail of that answer, nested one level deeper.
      push(answers, parent.id, card);
      nested.add(card.id);
    } else if (
      parent.type === "task" &&
      !WORK_ITEMS.has(card.type) &&
      card.type !== "option"
    ) {
      push(results, parent.id, card);
      nested.add(card.id);
    }
  }

  for (const link of graph.links as ResearchLink[]) {
    const a = byId.get(link.fromId);
    const b = byId.get(link.toId);
    if (!a || !b) continue;
    const kind = link.kind;
    // Links are read both ways: the agent may write either end first.
    for (const [x, y] of [
      [a, b],
      [b, a],
    ] as const) {
      if (
        x.type === "source" &&
        EVIDENCE_HOLDERS.has(y.type) &&
        (kind === "supports" || kind === "relates_to")
      ) {
        cite(x, y);
      } else if (
        kind === "answers" &&
        y.type === "question" &&
        !WORK_ITEMS.has(x.type)
      ) {
        push(answers, y.id, x);
        nested.add(x.id);
      } else if (
        kind === "answers" &&
        y.type === "task" &&
        !WORK_ITEMS.has(x.type)
      ) {
        push(results, y.id, x);
        nested.add(x.id);
      } else if (
        x.type === "option" &&
        WORK_ITEMS.has(y.type) &&
        (kind === "blocks" || kind === "relates_to")
      ) {
        const list = blockers.get(x.id) ?? [];
        const existing = list.find((entry) => entry.card.id === y.id);
        if (existing)
          existing.kind =
            existing.kind === "blocks" || kind === "blocks"
              ? "blocks"
              : "relates_to";
        else
          list.push({
            card: y,
            kind: kind === "blocks" ? "blocks" : "relates_to",
          });
        blockers.set(x.id, list);
      }
    }
  }

  for (const list of [
    ...answers.values(),
    ...results.values(),
    ...citations.values(),
  ])
    list.sort(byCardOrder);
  for (const list of blockers.values())
    list.sort((p, q) => byCardOrder(p.card, q.card));
  const citedSources = new Set(
    [...citations.values()].flat().map((card) => card.id),
  );
  return { answers, results, blockers, citations, citedSources, nested };
};
