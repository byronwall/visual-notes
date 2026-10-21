import { query } from "@solidjs/router";
import { listTopics, loadTopicGraph } from "./research.store";
import type { ResearchTopicGraph, ResearchTopicListItem } from "./research.types";

export const fetchResearchTopics = query(
  async (
    input: { refresh?: number; includeArchived?: boolean } = {},
  ): Promise<{ topics: ResearchTopicListItem[]; generatedAt: string }> => {
    "use server";
    // generatedAt lets SSR and hydration compute identical relative times.
    return {
      topics: await listTopics({ includeArchived: Boolean(input?.includeArchived) }),
      generatedAt: new Date().toISOString(),
    };
  },
  "research-topics",
);

export const fetchResearchTopicGraph = query(
  async (input: { slug: string; refresh?: number }): Promise<ResearchTopicGraph | null> => {
    "use server";
    const slug = String(input?.slug || "").trim();
    if (!slug) return null;
    return loadTopicGraph(slug);
  },
  "research-topic-graph",
);
