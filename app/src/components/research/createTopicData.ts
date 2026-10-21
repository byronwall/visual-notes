import { createMemo, createResource, createSignal, type Accessor } from "solid-js";
import { groupChildren } from "~/services/research/research.graph";
import { fetchResearchTopicGraph } from "~/services/research/research.queries";
import type { ResearchCard } from "~/services/research/research.types";

/** One topic's graph plus derived lookups; `reload()` refetches after writes. */
export const createTopicData = (slug: Accessor<string>) => {
  const [nonce, setNonce] = createSignal(0);
  const [graph] = createResource(
    () => ({ slug: slug(), refresh: nonce() }),
    (source) => fetchResearchTopicGraph(source),
  );

  const current = () => graph.latest ?? null;
  const cards = createMemo<ResearchCard[]>(() => current()?.cards ?? []);
  const cardsById = createMemo(() => new Map(cards().map((card) => [card.id, card])));
  const children = createMemo(() => groupChildren(cards()));
  const summaries = createMemo(() => {
    const byId = cardsById();
    return (current()?.groups ?? [])
      .map((group) => ({ group, card: byId.get(group.summaryCardId) }))
      .filter((entry): entry is { group: typeof entry.group; card: ResearchCard } => !!entry.card);
  });

  return {
    graph,
    current,
    cards,
    cardsById,
    children,
    summaries,
    reload: () => setNonce((n) => n + 1),
  };
};

export type TopicData = ReturnType<typeof createTopicData>;
