import { listFrontier } from "~/services/research/research.graph";
import type { ResearchCard, ResearchTopicGraph } from "~/services/research/research.types";

// Compact markdown views of a topic for agents. Every card carries its id in
// brackets so the agent can pass it back as `under`, a link end, or a cover.

const BODY_PREVIEW = 160;

const line = (card: ResearchCard) => {
  const state = card.state ? ` (${card.state})` : "";
  return `[${card.id}] ${card.type}${state}: ${card.title}`;
};

const preview = (body: string) => {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > BODY_PREVIEW ? `${flat.slice(0, BODY_PREVIEW)}…` : flat;
};

export const formatTopicSummary = (graph: ResearchTopicGraph): string => {
  const byId = new Map(graph.cards.map((card) => [card.id, card]));
  const plain = graph.cards.filter((card) => card.type !== "summary");
  const frontier = listFrontier(graph);
  const out: string[] = [
    `# ${graph.topic.title} (topic ${graph.topic.id}, slug ${graph.topic.slug})`,
    `${plain.length} cards, ${frontier.length} open.`,
    "",
    "## Summaries",
  ];
  const summaries = graph.groups
    .map((group) => ({ group, card: byId.get(group.summaryCardId) }))
    .filter((entry) => entry.card);
  if (!summaries.length) out.push("(none yet)");
  for (const { group, card } of summaries) {
    out.push(`- [${card!.id}] ${card!.title} — ${group.status}, covers ${group.memberIds.length}`);
    if (card!.body) out.push(`  ${preview(card!.body)}`);
  }
  out.push("", "## Frontier (open tasks and questions)");
  if (!frontier.length) out.push("(nothing open)");
  for (const { card, pedigree } of frontier) {
    const path = pedigree.map((p) => p.title).join(" › ");
    out.push(`- ${line(card)}${path ? `  ← ${path}` : ""}`);
  }
  const recent = graph.batches.slice(0, 5);
  if (recent.length) {
    out.push("", "## Recent batches");
    for (const batch of recent) {
      out.push(`- ${batch.batchKey} by ${batch.agent}: ${batch.summary || "(no summary)"}${batch.undoneAt ? " [undone]" : ""}`);
    }
  }
  return out.join("\n");
};

export const formatTopicOutline = (graph: ResearchTopicGraph): string => {
  const children = new Map<string | null, ResearchCard[]>();
  const ids = new Set(graph.cards.map((card) => card.id));
  for (const card of graph.cards) {
    if (card.type === "summary") continue;
    const key = card.parentId && ids.has(card.parentId) ? card.parentId : null;
    children.set(key, [...(children.get(key) ?? []), card]);
  }
  const out: string[] = [`# ${graph.topic.title} — full outline`, ""];
  const walk = (parentId: string | null, depth: number) => {
    for (const card of children.get(parentId) ?? []) {
      out.push(`${"  ".repeat(depth)}- ${line(card)}${card.url ? ` <${card.url}>` : ""}`);
      if (card.body) out.push(`${"  ".repeat(depth + 1)}${preview(card.body)}`);
      walk(card.id, depth + 1);
    }
  };
  walk(null, 0);
  if (graph.links.length) {
    out.push("", "## Related links");
    for (const link of graph.links) out.push(`- ${link.fromId} ↔ ${link.toId}`);
  }
  return out.join("\n");
};

export const formatCard = (graph: ResearchTopicGraph, cardId: string): string | null => {
  const byId = new Map(graph.cards.map((card) => [card.id, card]));
  const card = byId.get(cardId);
  if (!card) return null;
  const out = [line(card)];
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
  const kids = graph.cards.filter((c) => c.parentId === card.id);
  if (kids.length) out.push("", "Led to:", ...kids.map((kid) => `- ${line(kid)}`));
  const group = graph.groups.find((g) => g.summaryCardId === card.id);
  if (group) {
    out.push("", `Summary (${group.status}) covers:`);
    for (const id of group.memberIds) {
      const member = byId.get(id);
      if (member) out.push(`- ${line(member)}`);
    }
  }
  return out.join("\n");
};
