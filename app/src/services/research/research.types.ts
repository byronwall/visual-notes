export const RESEARCH_CARD_TYPES = [
  "task",
  "question",
  "finding",
  "source",
  "summary",
  "option",
  "criterion",
] as const;
export type ResearchCardType = (typeof RESEARCH_CARD_TYPES)[number];

export const RESEARCH_CARD_STATES = ["open", "done", "dropped"] as const;
export type ResearchCardState = (typeof RESEARCH_CARD_STATES)[number];

/** Only work items carry an open/done/dropped state; everything else is info. */
export const STATEFUL_CARD_TYPES: ReadonlySet<ResearchCardType> = new Set([
  "task",
  "question",
]);

export type ResearchSummaryStatus = "draft" | "accepted";

export type ResearchTopicListItem = {
  id: string;
  slug: string;
  title: string;
  topSummary: string | null;
  cardCount: number;
  openCount: number;
  lastActivityAt: string;
  archivedAt: string | null;
};

export type ResearchCard = {
  id: string;
  type: ResearchCardType;
  title: string;
  body: string;
  state: ResearchCardState | null;
  url: string | null;
  snippet: string | null;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  nudgeX: number | null;
  nudgeY: number | null;
  batchId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResearchLink = {
  id: string;
  fromId: string;
  toId: string;
  kind: string;
};

export type ResearchSummaryGroup = {
  id: string;
  summaryCardId: string;
  status: ResearchSummaryStatus;
  memberIds: string[];
};

export type ResearchBatch = {
  id: string;
  batchKey: string;
  agent: string;
  summary: string;
  cardCount: number;
  createdAt: string;
  undoneAt: string | null;
};

export type ResearchTopicGraph = {
  topic: { id: string; slug: string; title: string; archivedAt: string | null };
  cards: ResearchCard[];
  links: ResearchLink[];
  groups: ResearchSummaryGroup[];
  batches: ResearchBatch[];
  /** Server time of the read, so SSR and hydration format relative times alike. */
  generatedAt: string;
};
