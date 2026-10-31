import { UNSORTED_ID } from "~/services/research/research.streams";
import type {
  ResearchCard,
  ResearchCardType,
} from "~/services/research/research.types";
import {
  BLOCK_LABEL,
  type BoardBlockKey,
  type BoardModel,
  type BoardNode,
} from "../board/board-model";
import { SECTION_MIN, TYPE_ORDER } from "../layout/sections";

// The topic as one tree of titles: root, streams, sections, cards. Every card
// appears once. Ids stay the same across reloads, so open branches survive
// live updates.

export type MapKind = "root" | "stream" | "section" | "card";
export type MapSide = "right" | "left";

export type MapCounts = {
  total: number;
  open: number;
  done: number;
  byType: { type: ResearchCardType; count: number }[];
};

export type MapNode = {
  id: string;
  kind: MapKind;
  title: string;
  parentId: string | null;
  side: MapSide;
  children: MapNode[];
  counts: MapCounts;
  card?: ResearchCard;
  /** Key of a real stream, which the reader can open. */
  streamKey?: string;
  goal?: string;
};

export type MapTree = {
  root: MapNode;
  byId: Map<string, MapNode>;
  /** Node id per card id. */
  cardNodes: Map<string, string>;
};

const cardsUnder = (node: MapNode): ResearchCard[] => [
  ...(node.card ? [node.card] : []),
  ...node.children.flatMap(cardsUnder),
];

const countCards = (cards: ResearchCard[]): MapCounts => ({
  total: cards.length,
  open: cards.filter((card) => card.state === "open").length,
  done: cards.filter((card) => card.state === "done").length,
  byType: TYPE_ORDER.flatMap((type) => {
    const count = cards.filter((card) => card.type === type).length;
    return count ? [{ type, count }] : [];
  }),
});

const NO_COUNTS = countCards([]);

const branch = (
  fields: Pick<MapNode, "id" | "kind" | "title"> & Partial<MapNode>,
): MapNode => ({
  parentId: null,
  side: "right",
  children: [],
  counts: NO_COUNTS,
  ...fields,
});

/** Parent ids and sides flow down once the tree is whole. */
const seal = (
  node: MapNode,
  parentId: string | null,
  side: MapSide,
  tree: MapTree,
) => {
  node.parentId = parentId;
  node.side = side;
  node.counts = countCards(cardsUnder(node));
  tree.byId.set(node.id, node);
  if (node.card) tree.cardNodes.set(node.card.id, node.id);
  for (const child of node.children) seal(child, node.id, side, tree);
};

export const buildMapTree = (
  board: BoardModel,
  cards: ResearchCard[],
  title: string,
  answer: string,
): MapTree => {
  const placed = new Set<string>();
  const cardNode = (card: ResearchCard, kids: BoardNode[] = []): MapNode => {
    placed.add(card.id);
    return branch({
      id: `card:${card.id}`,
      kind: "card",
      title: card.title,
      card,
      children: kids.map((kid) => cardNode(kid.card, kid.children)),
    });
  };

  const streams: MapNode[] = [];
  if (board.topicCriteria.length)
    streams.push(
      branch({
        id: "stream:criteria",
        kind: "stream",
        title: "Criteria",
        goal: "Criteria for the whole topic.",
        children: board.topicCriteria.map((card) => cardNode(card)),
      }),
    );

  for (const model of board.columns) {
    const { column } = model;
    const sections = new Map<BoardBlockKey, MapNode[]>(
      model.blocks.map((block) => [
        block.key,
        block.nodes.map((node) => cardNode(node.card, node.children)),
      ]),
    );
    // The board shows cited sources as chips. The map lists them, so a search
    // hit always has a place to land.
    const cited = model.order
      .flatMap((id) => board.relations.citations.get(id) ?? [])
      .filter((source) => !placed.has(source.id));
    for (const source of new Set(cited)) {
      const list = sections.get("sources") ?? [];
      list.push(cardNode(source));
      sections.set("sources", list);
    }
    // A short stream skips the section level, as busy outline branches do the
    // reverse: its cards already show their type.
    const shortStream = [...sections.values()].flat().length <= SECTION_MIN;
    streams.push(
      branch({
        id: `stream:${column.id}`,
        kind: "stream",
        title: column.title,
        goal: column.goal,
        streamKey:
          column.virtual || column.id === UNSORTED_ID ? undefined : column.key,
        children: shortStream
          ? [...sections.values()].flat()
          : [...sections].map(([key, nodes]) =>
              branch({
                id: `section:${column.id}:${key}`,
                kind: "section",
                title: BLOCK_LABEL[key],
                children: nodes,
              }),
            ),
      }),
    );
  }

  const rest = cards.filter((card) => !placed.has(card.id));
  if (rest.length)
    streams.push(
      branch({
        id: "stream:other",
        kind: "stream",
        title: "Other",
        children: rest.map((card) => cardNode(card)),
      }),
    );

  const root = branch({
    id: "root",
    kind: "root",
    title,
    goal: answer,
    children: streams,
  });
  const tree: MapTree = { root, byId: new Map(), cardNodes: new Map() };
  // The first half reads down the right side, the rest down the left. Sides
  // come from stream order alone, so a branch never changes sides.
  const split = Math.ceil(streams.length / 2);
  root.counts = countCards(cards.filter((card) => card.type !== "summary"));
  tree.byId.set(root.id, root);
  streams.forEach((stream, index) =>
    seal(stream, root.id, index < split ? "right" : "left", tree),
  );
  return tree;
};

/** Node ids from the root down to a node's parent. */
export const ancestorsOf = (tree: MapTree, id: string): string[] => {
  const out: string[] = [];
  let parent = tree.byId.get(id)?.parentId;
  while (parent) {
    out.unshift(parent);
    parent = tree.byId.get(parent)?.parentId;
  }
  return out;
};
