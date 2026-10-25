import { listFrontier } from "~/services/research/research.graph";
import {
  buildRelations,
  byCardOrder,
} from "~/services/research/research.relations";
import {
  assignStreams,
  lintTopic,
  UNSORTED_ID,
} from "~/services/research/research.streams";
import { orderedFields } from "~/services/research/research.kinds";
import type {
  ResearchCard,
  ResearchKind,
  ResearchTopicGraph,
} from "~/services/research/research.types";

// Compact markdown views of a topic for agents, grouped by stream. Every card
// carries its id in brackets so the agent can pass it back as `under`, a link
// end, or an edit target; the header says how to build a card's app link.

const BODY_PREVIEW = 160;
const ANSWER_PREVIEW = 400;

const preview = (text: string, max = BODY_PREVIEW) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
};

const roleLabel = (card: ResearchCard) =>
  card.kind ? `${card.kind} (${card.type})` : card.type;

const line = (card: ResearchCard) => {
  const state = card.state ? ` (${card.state})` : "";
  return `[${card.id}] ${roleLabel(card)}${state}: ${card.title}`;
};

const fieldsText = (kinds: ResearchKind[], card: ResearchCard) =>
  orderedFields(kinds, card)
    .map((field) => `${field.key}: ${field.value}`)
    .join(" · ");

/** Title line plus gist (or a body preview when there is no gist). */
const withGist = (card: ResearchCard) => {
  const extra = card.gist || (card.body ? preview(card.body) : "");
  return extra ? `${line(card)} — ${extra}` : line(card);
};

const header = (graph: ResearchTopicGraph, appUrl?: string) => {
  const plain = graph.cards.filter((card) => card.type !== "summary");
  const open = plain.filter((card) => card.state === "open").length;
  const comments = graph.comments.filter(
    (comment) => !comment.resolvedAt,
  ).length;
  const out = [
    `# ${graph.topic.title} (topic ${graph.topic.id}, slug ${graph.topic.slug})`,
    `${plain.length} cards, ${open} open${comments ? `, ${comments} open comment${comments === 1 ? "" : "s"} for you` : ""}.`,
  ];
  if (appUrl) out.push(`Link a card for the user as ${appUrl}?card=<card id>.`);
  return out;
};

const kindsSection = (graph: ResearchTopicGraph) =>
  graph.topic.kinds.length
    ? [
        "",
        `Kinds: ${graph.topic.kinds
          .map(
            (kind) =>
              `${kind.key} = ${kind.label} (${kind.role}${kind.fields.length ? `; fields ${kind.fields.map((f) => f.key).join(", ")}` : ""})`,
          )
          .join("; ")}`,
      ]
    : [];

const commentsSection = (graph: ResearchTopicGraph) => {
  const open = graph.comments.filter((comment) => !comment.resolvedAt);
  if (!open.length) return [];
  const cards = new Map(graph.cards.map((card) => [card.id, card]));
  const streams = new Map(graph.streams.map((stream) => [stream.id, stream]));
  const out = [
    "",
    "## Comments for you (resolve with research_resolve_comments)",
  ];
  for (const comment of open) {
    const card = comment.cardId ? cards.get(comment.cardId) : undefined;
    const stream = comment.streamId ? streams.get(comment.streamId) : undefined;
    const where = card
      ? `on [${card.id}] “${card.title}”`
      : stream
        ? `on stream ${stream.key}`
        : "on the topic";
    out.push(`- [${comment.id}] ${where}: ${comment.body}`);
  }
  return out;
};

export const formatTopicSummary = (
  graph: ResearchTopicGraph,
  appUrl?: string,
): string => {
  const assignment = assignStreams(graph);
  const relations = buildRelations(graph);
  const frontier = listFrontier(graph);
  const out = [
    ...header(graph, appUrl),
    "",
    "## Answer",
    graph.topic.answer.trim()
      ? preview(graph.topic.answer, ANSWER_PREVIEW)
      : "(none yet: set it with research_update_topic answer)",
  ];
  out.push(...kindsSection(graph));
  if (assignment.topicCriteria.length) {
    out.push(
      "",
      "## Criteria (whole topic)",
      ...assignment.topicCriteria.map((card) => `- ${withGist(card)}`),
    );
  }

  const inColumn = (columnId: string) =>
    graph.cards.filter(
      (card) =>
        card.type !== "summary" &&
        assignment.streamOf.get(card.id) === columnId,
    );
  const columns = [
    ...assignment.columns,
    {
      id: UNSORTED_ID,
      key: "unsorted",
      title: "Unsorted",
      goal: "",
      answer: "",
      virtual: false,
    },
  ];
  out.push(
    "",
    graph.streams.length
      ? "## Streams"
      : "## Streams (none declared: one column per root card)",
  );
  for (const column of columns) {
    const cards = inColumn(column.id);
    if (
      column.id === UNSORTED_ID &&
      !cards.filter((card) => card.type !== "criterion").length
    )
      continue;
    const label =
      column.virtual || column.id === UNSORTED_ID
        ? column.title
        : `${column.title} [stream ${column.key}]`;
    out.push(
      "",
      `### ${label} — ${cards.length} card${cards.length === 1 ? "" : "s"}${column.goal ? ` · goal: ${column.goal}` : ""}`,
    );
    if (column.answer.trim())
      out.push(`Answer: ${preview(column.answer, ANSWER_PREVIEW)}`);
    const open = frontier.filter(
      (entry) => assignment.streamOf.get(entry.card.id) === column.id,
    );
    for (const { card, pedigree } of open) {
      const path = pedigree.map((p) => p.title).join(" › ");
      const answered = relations.answers.get(card.id)?.length ?? 0;
      out.push(
        `- ${line(card)}${answered ? ` · ${answered} answer${answered === 1 ? "" : "s"}` : ""}${path ? `  ← ${path}` : ""}`,
      );
    }
    for (const option of cards
      .filter((card) => card.type === "option")
      .sort(byCardOrder)) {
      const blockers = (relations.blockers.get(option.id) ?? []).filter(
        (entry) => entry.card.state === "open",
      );
      const fields = fieldsText(graph.topic.kinds, option);
      const blocked = blockers.length
        ? ` · blocked by ${blockers.map((entry) => `[${entry.card.id}]`).join(", ")}`
        : "";
      out.push(`- ${line(option)}${fields ? ` · ${fields}` : ""}${blocked}`);
    }
  }

  out.push(...commentsSection(graph));
  const warnings = lintTopic(graph, { relations, assignment });
  if (warnings.length)
    out.push(
      "",
      "## Worth fixing",
      ...warnings.map((warning) => `- ${warning}`),
    );
  const recent = graph.batches.slice(0, 5);
  if (recent.length) {
    out.push("", "## Recent batches");
    for (const batch of recent) {
      out.push(
        `- [${batch.id}] ${batch.batchKey} by ${batch.agent}: ${batch.summary || "(no summary)"}${batch.undoneAt ? " [undone]" : ""}`,
      );
    }
  }
  return out.join("\n");
};

export const formatTopicOutline = (
  graph: ResearchTopicGraph,
  appUrl?: string,
): string => {
  const assignment = assignStreams(graph);
  const ids = new Set(graph.cards.map((card) => card.id));
  const children = new Map<string | null, ResearchCard[]>();
  for (const card of graph.cards) {
    if (card.type === "summary") continue;
    const key = card.parentId && ids.has(card.parentId) ? card.parentId : null;
    children.set(key, [...(children.get(key) ?? []), card]);
  }
  for (const list of children.values()) list.sort(byCardOrder);
  const out = [...header(graph, appUrl), ...kindsSection(graph)];
  const walk = (card: ResearchCard, depth: number, columnId: string) => {
    const pad = "  ".repeat(depth);
    const fields = fieldsText(graph.topic.kinds, card);
    out.push(`${pad}- ${withGist(card)}${card.url ? ` <${card.url}>` : ""}`);
    if (fields) out.push(`${pad}  ${fields}`);
    for (const child of children.get(card.id) ?? []) {
      // A child that joined another stream is listed there instead.
      if (assignment.streamOf.get(child.id) === columnId)
        walk(child, depth + 1, columnId);
    }
  };
  const columns = [
    ...assignment.columns,
    {
      id: UNSORTED_ID,
      key: "unsorted",
      title: "Unsorted",
      goal: "",
      answer: "",
      virtual: false,
    },
  ];
  for (const column of columns) {
    const roots = graph.cards
      .filter(
        (card) =>
          card.type !== "summary" &&
          assignment.streamOf.get(card.id) === column.id,
      )
      .filter(
        (card) =>
          !card.parentId ||
          !ids.has(card.parentId) ||
          assignment.streamOf.get(card.parentId) !== column.id,
      )
      .sort(byCardOrder);
    if (!roots.length) continue;
    out.push(
      "",
      column.virtual || column.id === UNSORTED_ID
        ? `## ${column.title}`
        : `## ${column.title} [stream ${column.key}]`,
    );
    if (column.goal) out.push(`Goal: ${column.goal}`);
    if (column.answer.trim())
      out.push(`Answer: ${preview(column.answer, ANSWER_PREVIEW)}`);
    for (const root of roots) walk(root, 0, column.id);
  }
  if (graph.links.length) {
    out.push("", "## Links");
    for (const link of graph.links)
      out.push(`- ${link.fromId} ${link.kind} ${link.toId}`);
  }
  out.push(...commentsSection(graph));
  return out.join("\n");
};

export const formatCard = (
  graph: ResearchTopicGraph,
  cardId: string,
): string | null => {
  const byId = new Map(graph.cards.map((card) => [card.id, card]));
  const card = byId.get(cardId);
  if (!card) return null;
  const relations = buildRelations(graph);
  const assignment = assignStreams(graph);
  const out = [line(card)];
  const columnId = assignment.streamOf.get(card.id);
  const column = assignment.columns.find((entry) => entry.id === columnId);
  out.push(
    `Stream: ${column ? (column.virtual ? column.title : `${column.title} [${column.key}]`) : "Unsorted"}${card.streamId ? "" : column ? " (inherited)" : ""}`,
  );
  if (card.gist) out.push(`Gist: ${card.gist}`);
  const fields = fieldsText(graph.topic.kinds, card);
  if (fields) out.push(`Fields: ${fields}`);
  const chain: string[] = [];
  let cursor = card.parentId ? byId.get(card.parentId) : undefined;
  while (cursor && chain.length < 20) {
    chain.unshift(cursor.title);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  if (chain.length) out.push(`Came from: ${chain.join(" › ")}`);
  if (card.url) out.push(`URL: ${card.url}`);
  if (card.snippet) out.push(`Snippet: ${card.snippet}`);
  if (card.body) out.push("", card.body);

  const list = (label: string, cards: ResearchCard[]) => {
    if (cards.length)
      out.push("", `${label}:`, ...cards.map((entry) => `- ${line(entry)}`));
  };
  list("Answers", relations.answers.get(card.id) ?? []);
  list("Results", relations.results.get(card.id) ?? []);
  list("Sources", relations.citations.get(card.id) ?? []);
  const blockers = relations.blockers.get(card.id) ?? [];
  if (blockers.length) {
    out.push(
      "",
      "Blocked by / bears on:",
      ...blockers.map(
        (entry) =>
          `- ${entry.kind === "blocks" ? "blocks" : "related"}: ${line(entry.card)}`,
      ),
    );
  }
  const blocks = [...relations.blockers.entries()]
    .filter(([, entries]) => entries.some((entry) => entry.card.id === card.id))
    .map(([optionId]) => byId.get(optionId))
    .filter((entry): entry is ResearchCard => !!entry);
  list("Options it bears on", blocks);
  const answered = [...relations.answers.entries()]
    .filter(([, entries]) => entries.some((entry) => entry.id === card.id))
    .map(([id]) => byId.get(id))
    .filter((entry): entry is ResearchCard => !!entry);
  list("Answers these", answered);
  const cites = [...relations.citations.entries()]
    .filter(([, entries]) => entries.some((entry) => entry.id === card.id))
    .map(([id]) => byId.get(id))
    .filter((entry): entry is ResearchCard => !!entry);
  list("Backs", cites);
  list(
    "Led to",
    graph.cards.filter((c) => c.parentId === card.id).sort(byCardOrder),
  );

  const comments = graph.comments.filter(
    (comment) => comment.cardId === card.id,
  );
  if (comments.length) {
    out.push("", "Comments:");
    for (const comment of comments) {
      out.push(
        `- [${comment.id}] ${comment.author}: ${comment.body}${comment.resolvedAt ? ` (resolved${comment.resolution ? `: ${comment.resolution}` : ""})` : " (open)"}`,
      );
    }
  }
  return out.join("\n");
};

/** A topic's batch history, newest first, with ids for undo/redo. */
export const formatBatches = (graph: ResearchTopicGraph) =>
  graph.batches.map((batch) => ({
    id: batch.id,
    batchKey: batch.batchKey,
    agent: batch.agent,
    summary: batch.summary,
    cardCount: batch.cardCount,
    createdAt: batch.createdAt,
    undone: Boolean(batch.undoneAt),
  }));
