import type { IngestCardInput, IngestPayload } from "./research.payload";
import {
  STATEFUL_CARD_TYPES,
  type ResearchCardState,
  type ResearchCardType,
} from "./research.types";

export type PlannedCard = {
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
};

export type PlannedLink = { id: string; fromId: string; toId: string };

export type PlannedSummary = {
  groupId: string;
  card: PlannedCard;
  memberIds: string[];
};

export type IngestPlan = {
  /** Pre-order: every parent precedes its children. */
  cards: PlannedCard[];
  links: PlannedLink[];
  summaries: PlannedSummary[];
  /** Explicit refs and positional paths ($0, $0.1) mapped to new ids. */
  refs: Record<string, string>;
};

export type PlanResult =
  | { ok: true; plan: IngestPlan }
  | { ok: false; errors: string[] };

export type PlanContext = {
  /** Visible card ids already in the topic. */
  existingIds: ReadonlySet<string>;
  newId: () => string;
};

const optionalText = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * Turn a validated ingest payload into flat create operations, or explain
 * every problem at once. Pure so agents get the same answer every retry.
 */
export const planIngest = (payload: IngestPayload, ctx: PlanContext): PlanResult => {
  const errors: string[] = [];
  const refs: Record<string, string> = {};
  const cards: PlannedCard[] = [];

  if (payload.under && !ctx.existingIds.has(payload.under)) {
    errors.push(`under: no card "${payload.under}" in this topic`);
  }
  const rootParent = payload.under ?? null;

  const visit = (input: IngestCardInput, path: string, parentId: string | null, sortOrder: number) => {
    const id = ctx.newId();
    refs[path] = id;
    if (input.ref) {
      if (refs[input.ref] !== undefined) {
        errors.push(`${path}: duplicate ref "${input.ref}"`);
      } else {
        refs[input.ref] = id;
      }
    }
    const stateful = STATEFUL_CARD_TYPES.has(input.type);
    if (input.state && !stateful) {
      errors.push(`${path}: state only applies to task and question cards (got ${input.type})`);
    }
    cards.push({
      id,
      type: input.type,
      title: input.title.trim(),
      body: input.body ?? "",
      state: stateful ? (input.state ?? "open") : null,
      url: optionalText(input.url),
      snippet: optionalText(input.snippet),
      imageUrl: optionalText(input.imageUrl),
      parentId,
      sortOrder,
    });
    input.children?.forEach((child, index) => visit(child, `${path}.${index}`, id, index));
  };
  payload.cards.forEach((card, index) => visit(card, `$${index}`, rootParent, index));

  const resolve = (ref: string, where: string): string | null => {
    const fromPayload = refs[ref];
    if (fromPayload) return fromPayload;
    if (!ref.startsWith("$") && ctx.existingIds.has(ref)) return ref;
    errors.push(`${where}: unknown ref "${ref}"`);
    return null;
  };

  const links: PlannedLink[] = [];
  payload.links.forEach((link, index) => {
    const fromId = resolve(link.from, `links.${index}.from`);
    const toId = resolve(link.to, `links.${index}.to`);
    if (!fromId || !toId) return;
    if (fromId === toId) {
      errors.push(`links.${index}: a card cannot link to itself`);
      return;
    }
    links.push({ id: ctx.newId(), fromId, toId });
  });

  const summaries: PlannedSummary[] = [];
  payload.summaries.forEach((summary, index) => {
    const where = `summaries.${index}`;
    const memberIds = [
      ...new Set(
        summary.covers
          .map((ref, coverIndex) => resolve(ref, `${where}.covers.${coverIndex}`))
          .filter((id): id is string => id !== null),
      ),
    ];
    const cardId = ctx.newId();
    if (summary.ref) {
      if (refs[summary.ref] !== undefined) {
        errors.push(`${where}: duplicate ref "${summary.ref}"`);
      } else {
        refs[summary.ref] = cardId;
      }
    }
    summaries.push({
      groupId: ctx.newId(),
      memberIds,
      card: {
        id: cardId,
        type: "summary",
        title: summary.title.trim(),
        body: summary.body ?? "",
        state: null,
        url: null,
        snippet: null,
        imageUrl: null,
        parentId: null,
        sortOrder: index,
      },
    });
  });

  // Judge emptiness by what was sent, so invalid links don't also read as "empty".
  if (payload.cards.length + payload.links.length + payload.summaries.length === 0) {
    errors.push("payload is empty: add cards, links, or summaries");
  }

  return errors.length ? { ok: false, errors } : { ok: true, plan: { cards, links, summaries, refs } };
};
