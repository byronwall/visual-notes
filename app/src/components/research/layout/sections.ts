import type { ResearchCardType } from "~/services/research/research.types";

/**
 * Busy branches split their children into type sections. The canvas lanes,
 * the outline headings, and the contents list all use this one order.
 */
export const TYPE_ORDER: readonly ResearchCardType[] = [
  "criterion",
  "option",
  "finding",
  "question",
  "task",
  "source",
  "summary",
];

export const TYPE_PLURAL: Record<ResearchCardType, string> = {
  criterion: "Criteria",
  option: "Options",
  finding: "Findings",
  question: "Questions",
  task: "Tasks",
  source: "Sources",
  summary: "Summaries",
};

/** A branch with more children than this lists them in labeled type sections. */
export const SECTION_MIN = 6;

export type TypeSection<T> = { type: ResearchCardType; items: T[] };

/** Items grouped by card type in `TYPE_ORDER`, keeping their order inside each type. */
export const sectionByType = <T>(items: readonly T[], typeOf: (item: T) => ResearchCardType): TypeSection<T>[] => {
  const byType = new Map<ResearchCardType, T[]>();
  for (const item of items) {
    const type = typeOf(item);
    const list = byType.get(type) ?? [];
    list.push(item);
    byType.set(type, list);
  }
  return TYPE_ORDER.filter((type) => byType.has(type)).map((type) => ({ type, items: byType.get(type)! }));
};
