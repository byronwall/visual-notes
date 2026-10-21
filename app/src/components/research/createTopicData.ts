import { createMemo, createResource, createSignal, type Accessor } from "solid-js";
import { useAppChanges } from "~/features/live-sync/NoteLiveSyncProvider";
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

  const reload = () => setNonce((n) => n + 1);
  // Agents write over MCP while the canvas is open; pick their batches up.
  useAppChanges("research", reload, (id) => id === current()?.topic.id);

  return {
    graph,
    current,
    cards,
    cardsById,
    children,
    summaries,
    reload,
  };
};

export type TopicData = ReturnType<typeof createTopicData>;
