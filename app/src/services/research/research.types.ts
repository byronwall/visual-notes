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

/** What a link says about its two ends; came-from children imply the same. */
export const RESEARCH_LINK_KINDS = [
  "relates_to",
  "answers",
  "blocks",
  "supports",
] as const;
export type ResearchLinkKind = (typeof RESEARCH_LINK_KINDS)[number];

export const MAX_STREAMS = 10;
export const MAX_KINDS = 12;

/** A topic-declared card kind layered on a role (the card type). */
export type ResearchKind = {
  key: string;
  label: string;
  role: Exclude<ResearchCardType, "summary">;
  fields: { key: string; label: string }[];
};

export type ResearchStream = {
  id: string;
  key: string;
  title: string;
  goal: string;
  answer: string;
  sortOrder: number;
  batchId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResearchComment = {
  id: string;
  cardId: string | null;
  streamId: string | null;
  body: string;
  author: string;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
};

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
  gist: string;
  body: string;
  kind: string | null;
  fields: Record<string, string>;
  streamId: string | null;
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
  topic: {
    id: string;
    slug: string;
    title: string;
    archivedAt: string | null;
    answer: string;
    kinds: ResearchKind[];
  };
  streams: ResearchStream[];
  comments: ResearchComment[];
  cards: ResearchCard[];
  links: ResearchLink[];
  groups: ResearchSummaryGroup[];
  batches: ResearchBatch[];
  /** Server time of the read, so SSR and hydration format relative times alike. */
  generatedAt: string;
};
