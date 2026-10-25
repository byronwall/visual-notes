import {
  buildRelations,
  byCardOrder,
  type TopicRelations,
} from "~/services/research/research.relations";
import {
  assignStreams,
  UNSORTED_ID,
  type StreamAssignment,
  type StreamColumn,
} from "~/services/research/research.streams";
import type {
  ResearchCard,
  ResearchTopicGraph,
} from "~/services/research/research.types";

// The stream board as data: one column per stream, fixed blocks in a fixed
// order, cards in creation order inside each block. Nothing here depends on
// screen size, so a card only moves when its own column changes above it.

export type BoardNode = { card: ResearchCard; children: BoardNode[] };

export const BLOCKS = [
  "criteria",
  "options",
  "questions",
  "tasks",
  "notes",
  "sources",
] as const;
export type BoardBlockKey = (typeof BLOCKS)[number];

export const BLOCK_LABEL: Record<BoardBlockKey, string> = {
  criteria: "Criteria",
  questions: "Questions",
  options: "Options",
  tasks: "Tasks",
  notes: "Notes",
  sources: "Sources",
};

export type BoardColumnModel = {
  column: StreamColumn;
  blocks: { key: BoardBlockKey; nodes: BoardNode[] }[];
  cardCount: number;
  openCount: number;
  /** Every card in reading order, for prev/next in the reader. */
  order: string[];
};

export type BoardModel = {
  columns: BoardColumnModel[];
  topicCriteria: ResearchCard[];
  relations: TopicRelations;
  assignment: StreamAssignment;
  /** Column id per card, including cited sources (their holder's column). */
  columnOf: Map<string, string>;
};

type Graph = Pick<ResearchTopicGraph, "cards" | "links" | "streams">;

const blockFor = (card: ResearchCard): BoardBlockKey => {
  switch (card.type) {
    case "criterion":
      return "criteria";
    case "question":
      return "questions";
    case "option":
      return "options";
    case "task":
      return "tasks";
    case "source":
      return "sources";
    default:
      return "notes";
  }
};

// Deep chains still render; cycles stop at the `seen` set.
const MAX_DEPTH = 12;

export const buildBoard = (graph: Graph): BoardModel => {
  const relations = buildRelations(graph);
  const assignment = assignStreams(graph);
  const { streamOf } = assignment;
  const topicCriteriaIds = new Set(
    assignment.topicCriteria.map((card) => card.id),
  );

  // A card nests under its holder only when both sit in the same column;
  // otherwise it stays a card of its own column and the relation shows as a chip.
  const nestedIn = new Map<string, ResearchCard[]>();
  const nestedHere = new Set<string>();
  for (const map of [relations.answers, relations.results]) {
    for (const [holderId, cards] of map) {
      for (const card of cards) {
        if (
          streamOf.get(card.id) !== streamOf.get(holderId) ||
          card.id === holderId
        )
          continue;
        const list = nestedIn.get(holderId) ?? [];
        if (!list.includes(card)) list.push(card);
        nestedIn.set(holderId, list);
        nestedHere.add(card.id);
      }
    }
  }
  for (const list of nestedIn.values()) list.sort(byCardOrder);

  const nodeOf = (
    card: ResearchCard,
    depth: number,
    seen: Set<string>,
  ): BoardNode => {
    seen.add(card.id);
    const kids =
      depth >= MAX_DEPTH
        ? []
        : (nestedIn.get(card.id) ?? []).filter((kid) => !seen.has(kid.id));
    return { card, children: kids.map((kid) => nodeOf(kid, depth + 1, seen)) };
  };

  const columns: StreamColumn[] = [
    ...assignment.columns,
    {
      id: UNSORTED_ID,
      key: "unsorted",
      title: "Unsorted",
      goal: "Cards in no stream yet.",
      answer: "",
      virtual: false,
    },
  ];

  const columnOf = new Map(streamOf);
  for (const [holderId, sources] of relations.citations) {
    for (const source of sources)
      columnOf.set(source.id, streamOf.get(holderId) ?? UNSORTED_ID);
  }

  const models = columns.map((column): BoardColumnModel => {
    const cards = graph.cards
      .filter(
        (card) =>
          streamOf.get(card.id) === column.id && !topicCriteriaIds.has(card.id),
      )
      .sort(byCardOrder);
    const units = cards.filter(
      (card) =>
        !nestedHere.has(card.id) && !relations.citedSources.has(card.id),
    );
    const seen = new Set<string>();
    const blocks = BLOCKS.map((key) => ({
      key,
      nodes: units
        .filter((card) => blockFor(card) === key)
        .map((card) => nodeOf(card, 0, seen)),
    })).filter((block) => block.nodes.length);
    const order: string[] = [];
    const walk = (node: BoardNode) => {
      order.push(node.card.id);
      node.children.forEach(walk);
    };
    for (const block of blocks) block.nodes.forEach(walk);
    return {
      column,
      blocks,
      cardCount: cards.length,
      openCount: cards.filter((card) => card.state === "open").length,
      order,
    };
  });

  return {
    // Unsorted shows only when something landed there.
    columns: models.filter(
      (model) => model.column.id !== UNSORTED_ID || model.blocks.length,
    ),
    topicCriteria: assignment.topicCriteria,
    relations,
    assignment,
    columnOf,
  };
};

/** Cards a card is related to, for hover highlighting and the reader. */
export const relatedIds = (
  model: BoardModel,
  card: ResearchCard,
): Set<string> => {
  const out = new Set<string>();
  const { relations } = model;
  for (const list of [
    relations.answers.get(card.id),
    relations.results.get(card.id),
    relations.citations.get(card.id),
  ]) {
    for (const entry of list ?? []) out.add(entry.id);
  }
  for (const entry of relations.blockers.get(card.id) ?? [])
    out.add(entry.card.id);
  for (const [optionId, entries] of relations.blockers) {
    if (entries.some((entry) => entry.card.id === card.id)) out.add(optionId);
  }
  for (const map of [
    relations.answers,
    relations.results,
    relations.citations,
  ]) {
    for (const [holderId, entries] of map)
      if (entries.some((entry) => entry.id === card.id)) out.add(holderId);
  }
  if (card.parentId) out.add(card.parentId);
  out.delete(card.id);
  return out;
};
