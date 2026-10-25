import type { IngestCardInput, IngestPayload } from "./research.payload";
import {
  STATEFUL_CARD_TYPES,
  type ResearchCardState,
  type ResearchCardType,
  type ResearchKind,
  type ResearchLinkKind,
} from "./research.types";

export type PlannedCard = {
  id: string;
  type: ResearchCardType;
  title: string;
  gist: string;
  body: string;
  kind: string | null;
  fields: Record<string, string> | null;
  streamId: string | null;
  state: ResearchCardState | null;
  url: string | null;
  snippet: string | null;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
};

export type PlannedLink = {
  id: string;
  fromId: string;
  toId: string;
  kind: ResearchLinkKind;
};

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
  /** Accepted but worth fixing, e.g. a field the kind does not declare. */
  warnings: string[];
};

export type PlanResult =
  | { ok: true; plan: IngestPlan }
  | { ok: false; errors: string[] };

export type PlanContext = {
  /** Visible card ids already in the topic. */
  existingIds: ReadonlySet<string>;
  newId: () => string;
  /** Declared stream keys → stream ids. */
  streams?: ReadonlyMap<string, string>;
  kinds?: readonly ResearchKind[];
  /** Next free sortOrder per existing parent, so new cards go after old ones. */
  nextSortOrder?: (parentId: string | null) => number;
};

/** Field values as stored text; nulls and blanks are dropped. */
export const normalizeFields = (
  fields: Record<string, string | number | boolean | null> | undefined,
) => {
  if (!fields) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || String(value).trim() === "") continue;
    out[key.trim()] = String(value).trim();
  }
  return Object.keys(out).length ? out : null;
};

const optionalText = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * Turn a validated ingest payload into flat create operations, or explain
 * every problem at once. Pure so agents get the same answer every retry.
 */
export const planIngest = (
  payload: IngestPayload,
  ctx: PlanContext,
): PlanResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const refs: Record<string, string> = {};
  const cards: PlannedCard[] = [];
  const kinds = new Map((ctx.kinds ?? []).map((kind) => [kind.key, kind]));
  const declaredKinds = () =>
    kinds.size
      ? [...kinds.keys()].join(", ")
      : "none declared; set kinds with research_update_topic";
  const declaredStreams = () =>
    ctx.streams?.size
      ? [...ctx.streams.keys()].join(", ")
      : "none declared; set streams with research_update_topic";
  const undeclaredFields = new Set<string>();

  if (payload.under && !ctx.existingIds.has(payload.under)) {
    errors.push(`under: no card "${payload.under}" in this topic`);
  }
  const rootParent = payload.under ?? null;

  const visit = (
    input: IngestCardInput,
    path: string,
    parentId: string | null,
    sortOrder: number,
  ) => {
    const id = ctx.newId();
    refs[path] = id;
    if (input.ref) {
      if (refs[input.ref] !== undefined) {
        errors.push(`${path}: duplicate ref "${input.ref}"`);
      } else {
        refs[input.ref] = id;
      }
    }
    const kind = input.kind ? kinds.get(input.kind) : undefined;
    if (input.kind && !kind)
      errors.push(
        `${path}: unknown kind "${input.kind}" (declared: ${declaredKinds()})`,
      );
    if (kind && input.type && kind.role !== input.type) {
      errors.push(
        `${path}: kind "${kind.key}" is a ${kind.role}, not a ${input.type}`,
      );
    }
    const type = input.type ?? kind?.role;
    if (!type && !input.kind)
      errors.push(`${path}: give a type or a declared kind`);
    let streamId: string | null = null;
    if (input.stream) {
      streamId = ctx.streams?.get(input.stream) ?? null;
      if (!streamId)
        errors.push(
          `${path}: unknown stream "${input.stream}" (declared: ${declaredStreams()})`,
        );
    }
    const fields = normalizeFields(input.fields);
    if (fields && kind) {
      const known = new Set(kind.fields.map((field) => field.key));
      for (const key of Object.keys(fields))
        if (!known.has(key)) undeclaredFields.add(`${kind.key}.${key}`);
    }
    const role = type ?? "finding";
    const stateful = STATEFUL_CARD_TYPES.has(role);
    if (input.state && !stateful) {
      errors.push(
        `${path}: state only applies to task and question cards (got ${role})`,
      );
    }
    cards.push({
      id,
      type: role,
      title: input.title.trim(),
      gist: input.gist?.trim() ?? "",
      body: input.body ?? "",
      kind: kind?.key ?? null,
      fields,
      streamId,
      state: stateful ? input.state ?? "open" : null,
      url: optionalText(input.url),
      snippet: optionalText(input.snippet),
      imageUrl: optionalText(input.imageUrl),
      parentId,
      sortOrder,
    });
    input.children?.forEach((child, index) =>
      visit(child, `${path}.${index}`, id, index),
    );
  };
  const rootOffset = ctx.nextSortOrder?.(rootParent) ?? 0;
  payload.cards.forEach((card, index) =>
    visit(card, `$${index}`, rootParent, rootOffset + index),
  );
  if (undeclaredFields.size) {
    warnings.push(
      `fields not declared on their kind were kept: ${[...undeclaredFields].join(", ")}`,
    );
  }

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
    links.push({
      id: ctx.newId(),
      fromId,
      toId,
      kind: link.kind ?? "relates_to",
    });
  });

  const summaries: PlannedSummary[] = [];
  payload.summaries.forEach((summary, index) => {
    const where = `summaries.${index}`;
    const memberIds = [
      ...new Set(
        summary.covers
          .map((ref, coverIndex) =>
            resolve(ref, `${where}.covers.${coverIndex}`),
          )
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
        gist: "",
        body: summary.body ?? "",
        kind: null,
        fields: null,
        streamId: null,
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
  if (
    payload.cards.length + payload.links.length + payload.summaries.length ===
    0
  ) {
    errors.push("payload is empty: add cards, links, or summaries");
  }

  return errors.length
    ? { ok: false, errors }
    : { ok: true, plan: { cards, links, summaries, refs, warnings } };
};
