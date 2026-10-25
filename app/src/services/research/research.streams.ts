import {
  buildRelations,
  byCardOrder,
  type TopicRelations,
} from "./research.relations";
import type { ResearchCard, ResearchTopicGraph } from "./research.types";

// Which stream each card belongs to, and the lint that keeps streams honest.
// A card's stream is its own explicit stream, else its nearest came-from
// ancestor's, else Unsorted. Links never move a card between streams.

export const UNSORTED_ID = "unsorted";

export type StreamColumn = {
  id: string;
  key: string;
  title: string;
  goal: string;
  answer: string;
  /** Derived from a root card because the topic declares no streams. */
  virtual: boolean;
};

type Graph = Pick<ResearchTopicGraph, "cards" | "links" | "streams">;

export type StreamAssignment = {
  columns: StreamColumn[];
  /** Card id → column id (or UNSORTED_ID). */
  streamOf: Map<string, string>;
  /** Criteria in no stream: they apply to the whole topic. */
  topicCriteria: ResearchCard[];
};

const ancestorStream = (
  card: ResearchCard,
  byId: Map<string, ResearchCard>,
  streamIds: Set<string>,
) => {
  const seen = new Set<string>();
  let cursor: ResearchCard | undefined = card;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    if (cursor.streamId && streamIds.has(cursor.streamId))
      return cursor.streamId;
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return null;
};

const rootOf = (card: ResearchCard, byId: Map<string, ResearchCard>) => {
  const seen = new Set<string>();
  let cursor = card;
  while (cursor.parentId && byId.has(cursor.parentId) && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    cursor = byId.get(cursor.parentId)!;
  }
  return cursor;
};

/** Roles that start a stream when a topic has not declared any. */
const LEGACY_STREAM_ROOTS = new Set<ResearchCard["type"]>([
  "question",
  "task",
  "option",
  "finding",
]);

export const assignStreams = (graph: Graph): StreamAssignment => {
  const cards = graph.cards;
  const byId = new Map(cards.map((card) => [card.id, card]));
  const streamOf = new Map<string, string>();
  let columns: StreamColumn[];

  if (graph.streams.length) {
    columns = [...graph.streams]
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt),
      )
      .map((stream) => ({
        id: stream.id,
        key: stream.key,
        title: stream.title,
        goal: stream.goal,
        answer: stream.answer,
        virtual: false,
      }));
    const ids = new Set(columns.map((column) => column.id));
    for (const card of cards)
      streamOf.set(card.id, ancestorStream(card, byId, ids) ?? UNSORTED_ID);
  } else {
    // Older topics: each root question, task, option, or finding is its own stream.
    const roots = cards
      .filter((card) => !card.parentId || !byId.has(card.parentId))
      .sort(byCardOrder);
    columns = roots
      .filter((card) => LEGACY_STREAM_ROOTS.has(card.type))
      .map((card) => ({
        id: `root:${card.id}`,
        key: card.id,
        title: card.title,
        goal: "",
        answer: "",
        virtual: true,
      }));
    const ids = new Set(columns.map((column) => column.id));
    for (const card of cards) {
      const column = `root:${rootOf(card, byId).id}`;
      streamOf.set(card.id, ids.has(column) ? column : UNSORTED_ID);
    }
  }

  const topicCriteria = cards
    .filter(
      (card) =>
        card.type === "criterion" && streamOf.get(card.id) === UNSORTED_ID,
    )
    .sort(byCardOrder);
  return { columns, streamOf, topicCriteria };
};

export type LintOptions = {
  /** Only judge these cards (a write's new or edited cards); topic-wide checks still run. */
  cardIds?: ReadonlySet<string>;
  relations?: TopicRelations;
  assignment?: StreamAssignment;
};

export const TITLE_SOFT_MAX = 80;
export const GIST_BODY_THRESHOLD = 280;
export const FANOUT_SOFT_MAX = 8;

const quote = (cards: ResearchCard[], limit = 3) => {
  const names = cards
    .slice(0, limit)
    .map((card) => `“${card.title.slice(0, 60)}”`);
  return cards.length > limit
    ? `${names.join(", ")} and ${cards.length - limit} more`
    : names.join(", ");
};

/**
 * Guidance for agents, never a rejection: each line says what is off and
 * what to do. Empty when the topic reads well.
 */
export const lintTopic = (
  graph: Graph,
  options: LintOptions = {},
): string[] => {
  const relations = options.relations ?? buildRelations(graph);
  const assignment = options.assignment ?? assignStreams(graph);
  const inScope = (card: ResearchCard) =>
    !options.cardIds || options.cardIds.has(card.id);
  const cards = graph.cards.filter((card) => card.type !== "summary");
  const scoped = cards.filter(inScope);
  const warnings: string[] = [];

  if (graph.streams.length) {
    const unsorted = scoped.filter(
      (card) =>
        assignment.streamOf.get(card.id) === UNSORTED_ID &&
        card.type !== "criterion" &&
        !relations.citedSources.has(card.id),
    );
    if (unsorted.length) {
      warnings.push(
        `${unsorted.length} card${unsorted.length === 1 ? " is" : "s are"} in no stream (${quote(unsorted)}): set "stream" on the root card or add them under a card that has one.`,
      );
    }
  } else if (cards.length >= 12) {
    warnings.push(
      `This topic declares no streams, so each root card is its own column. Declare 1–10 streams with research_update_topic and set "stream" on root cards.`,
    );
  }

  const longTitles = scoped.filter(
    (card) => card.title.length > TITLE_SOFT_MAX,
  );
  if (longTitles.length) {
    warnings.push(
      `${longTitles.length} title${longTitles.length === 1 ? " is" : "s are"} over ${TITLE_SOFT_MAX} characters (${quote(longTitles, 2)}): keep the title short and put the rest in "gist".`,
    );
  }

  const noGist = scoped.filter(
    (card) => !card.gist.trim() && card.body.length > GIST_BODY_THRESHOLD,
  );
  if (noGist.length) {
    warnings.push(
      `${noGist.length} card${noGist.length === 1 ? " has" : "s have"} a long body but no "gist" (${quote(noGist, 2)}): add one or two sentences the board can show.`,
    );
  }

  const childCount = new Map<string, number>();
  for (const card of cards) {
    if (!card.parentId || relations.citedSources.has(card.id)) continue;
    childCount.set(card.parentId, (childCount.get(card.parentId) ?? 0) + 1);
  }
  const byId = new Map(cards.map((card) => [card.id, card]));
  for (const [parentId, count] of childCount) {
    const parent = byId.get(parentId);
    if (!parent || count <= FANOUT_SOFT_MAX) continue;
    const touched =
      cards.some((card) => card.parentId === parentId && inScope(card)) ||
      inScope(parent);
    if (!touched) continue;
    warnings.push(
      `“${parent.title.slice(0, 60)}” has ${count} cards under it: group them into streams or sub-questions so each parent holds about ${FANOUT_SOFT_MAX} or fewer.`,
    );
  }

  const folderCriteria = cards.filter(
    (card) =>
      card.type === "criterion" &&
      cards.some((child) => child.parentId === card.id && inScope(child)),
  );
  for (const criterion of folderCriteria) {
    warnings.push(
      `Criterion “${criterion.title.slice(0, 60)}” has cards under it. Criteria are not folders: attach sources to the findings they back (link kind "supports") and put other cards in a stream.`,
    );
  }

  const looseSources = scoped.filter(
    (card) => card.type === "source" && !relations.citedSources.has(card.id),
  );
  if (looseSources.length >= 3) {
    warnings.push(
      `${looseSources.length} sources back nothing (${quote(looseSources, 2)}): add each under the finding it supports, or link it with kind "supports".`,
    );
  }

  return warnings;
};
