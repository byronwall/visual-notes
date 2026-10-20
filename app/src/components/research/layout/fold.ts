import type {
  ResearchCard,
  ResearchLink,
  ResearchSummaryGroup,
} from "~/services/research/research.types";

/**
 * Semantic zoom: at fold level L every accepted summary group whose nesting
 * height is <= L collapses into its summary card. Open tasks/questions inside
 * a folded group stay visible and hang from the summary. Draft groups never
 * fold; unfolded groups are drawn as hulls around their visible members.
 */

export type FoldNode = {
  id: string;
  card: ResearchCard;
  kind: "card" | "summary";
  faded: boolean;
  /** Summary nodes: plain cards folded inside, and how many of those are open. */
  coveredCount: number;
  openInside: number;
  groupId: string | null;
};

export type FoldEdge = { from: string; to: string; kind: "also" | "relates" };

export type FoldHull = {
  groupId: string;
  summaryCard: ResearchCard;
  status: ResearchSummaryGroup["status"];
  memberNodeIds: string[];
  /** Hull groups nested inside this one, for padding. */
  innerCount: number;
};

export type FoldView = {
  nodes: FoldNode[];
  /** Visible came-from parent per node (null for roots). */
  parent: Map<string, string | null>;
  /** Children per parent (null = roots), in display order. */
  children: Map<string | null, string[]>;
  edges: FoldEdge[];
  hulls: FoldHull[];
  /** Card id → id of the visible node that stands for it (itself or a summary). */
  rep: Map<string, string>;
  maxLevel: number;
};

const isPlain = (card: ResearchCard) => card.type !== "summary";
const isFadedState = (card: ResearchCard) => card.state === "done" || card.state === "dropped";

export const foldView = (input: {
  cards: ResearchCard[];
  groups: ResearchSummaryGroup[];
  links?: ResearchLink[];
  level: number;
}): FoldView => {
  const cardsById = new Map(input.cards.map((card) => [card.id, card]));
  const groups = input.groups.filter((group) => cardsById.has(group.summaryCardId));
  const groupBySummary = new Map(groups.map((group) => [group.summaryCardId, group]));
  const accepted = groups.filter((group) => group.status === "accepted");

  // Nesting height over accepted groups: 1 + tallest accepted group it covers.
  const heights = new Map<string, number>();
  const heightOf = (group: ResearchSummaryGroup, trail = new Set<string>()): number => {
    const known = heights.get(group.id);
    if (known !== undefined) return known;
    if (trail.has(group.id)) return 1;
    trail.add(group.id);
    let tallest = 0;
    for (const memberId of group.memberIds) {
      const inner = groupBySummary.get(memberId);
      if (inner?.status === "accepted") tallest = Math.max(tallest, heightOf(inner, trail));
    }
    heights.set(group.id, tallest + 1);
    return tallest + 1;
  };
  accepted.forEach((group) => heightOf(group));
  const maxLevel = Math.max(0, ...accepted.map((group) => heights.get(group.id) ?? 1));

  const folded = new Set(
    accepted.filter((group) => (heights.get(group.id) ?? 1) <= input.level).map((group) => group.id),
  );

  // Everything a folded group swallows, outermost group first.
  const owner = new Map<string, string>();
  const expandFolded = (group: ResearchSummaryGroup, out: Set<string>, trail: Set<string>) => {
    if (trail.has(group.id)) return;
    trail.add(group.id);
    for (const memberId of group.memberIds) {
      if (!cardsById.has(memberId)) continue;
      out.add(memberId);
      const inner = groupBySummary.get(memberId);
      if (inner && folded.has(inner.id)) expandFolded(inner, out, trail);
    }
  };
  const swallowed = new Map<string, Set<string>>();
  [...folded]
    .map((id) => groups.find((group) => group.id === id)!)
    .sort((a, b) => (heights.get(b.id) ?? 1) - (heights.get(a.id) ?? 1))
    .forEach((group) => {
      const members = new Set<string>();
      expandFolded(group, members, new Set());
      swallowed.set(group.id, members);
      for (const id of members) if (!owner.has(id)) owner.set(id, group.id);
    });

  const isVisible = (card: ResearchCard) => {
    if (isPlain(card)) return !owner.has(card.id) || card.state === "open";
    const group = groupBySummary.get(card.id);
    return !!group && folded.has(group.id) && !owner.has(card.id);
  };

  const repCache = new Map<string, string | null>();
  const repOf = (id: string, trail = new Set<string>()): string | null => {
    if (repCache.has(id)) return repCache.get(id)!;
    const card = cardsById.get(id);
    let result: string | null = null;
    if (card && isVisible(card)) result = id;
    else if (card && owner.has(id) && !trail.has(id)) {
      trail.add(id);
      const group = groups.find((candidate) => candidate.id === owner.get(id))!;
      result = repOf(group.summaryCardId, trail);
    }
    repCache.set(id, result);
    return result;
  };

  // Nearest visible ancestor through the came-from chain.
  const visibleAncestor = (card: ResearchCard, self: string): string | null => {
    let parentId = card.parentId;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const rep = repOf(parentId);
      if (rep && rep !== self) return rep;
      parentId = cardsById.get(parentId)?.parentId ?? null;
    }
    return null;
  };

  const depthCache = new Map<string, number>();
  const depthOf = (card: ResearchCard): number => {
    const known = depthCache.get(card.id);
    if (known !== undefined) return known;
    depthCache.set(card.id, 0);
    const parent = card.parentId ? cardsById.get(card.parentId) : undefined;
    const depth = parent ? depthOf(parent) + 1 : 0;
    depthCache.set(card.id, depth);
    return depth;
  };

  const fadedCache = new Map<string, boolean>();
  const fadedOf = (card: ResearchCard): boolean => {
    const known = fadedCache.get(card.id);
    if (known !== undefined) return known;
    fadedCache.set(card.id, false);
    const parent = card.parentId ? cardsById.get(card.parentId) : undefined;
    const faded = isFadedState(card) || (!!parent && fadedOf(parent) && card.state !== "open");
    fadedCache.set(card.id, faded);
    return faded;
  };

  const nodes: FoldNode[] = [];
  const parent = new Map<string, string | null>();
  const edges: FoldEdge[] = [];
  const edgeKeys = new Set<string>();
  const addEdge = (from: string, to: string, kind: FoldEdge["kind"]) => {
    const key = [from, to].sort().join("|");
    if (from === to || edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ from, to, kind });
  };
  const sortKey = new Map<string, number>();

  for (const card of input.cards) {
    if (!isVisible(card)) continue;
    if (isPlain(card)) {
      nodes.push({
        id: card.id,
        card,
        kind: "card",
        faded: fadedOf(card),
        coveredCount: 0,
        openInside: 0,
        groupId: null,
      });
      parent.set(card.id, visibleAncestor(card, card.id));
      continue;
    }
    const group = groupBySummary.get(card.id)!;
    const plainMembers = [...(swallowed.get(group.id) ?? [])]
      .map((id) => cardsById.get(id)!)
      .filter(isPlain)
      .sort((a, b) => depthOf(a) - depthOf(b) || a.sortOrder - b.sortOrder);
    nodes.push({
      id: card.id,
      card,
      kind: "summary",
      faded: plainMembers.length > 0 && plainMembers.every(fadedOf),
      coveredCount: plainMembers.length,
      openInside: plainMembers.filter((member) => member.state === "open").length,
      groupId: group.id,
    });
    let primary: string | null = null;
    for (const member of plainMembers) {
      const ancestor = visibleAncestor(member, card.id);
      if (!ancestor) continue;
      if (primary === null) primary = ancestor;
      else if (ancestor !== primary) addEdge(ancestor, card.id, "also");
    }
    parent.set(card.id, primary);
    sortKey.set(card.id, plainMembers[0]?.sortOrder ?? card.sortOrder);
  }

  // Break any cycle a cross-branch group can create (parent → summary → parent).
  for (const node of nodes) {
    const seen = new Set<string>([node.id]);
    let cursor = parent.get(node.id) ?? null;
    while (cursor) {
      if (seen.has(cursor)) {
        const inCycle = [...seen].find((id) => nodes.find((n) => n.id === id)?.kind === "summary");
        if (inCycle) parent.set(inCycle, null);
        break;
      }
      seen.add(cursor);
      cursor = parent.get(cursor) ?? null;
    }
  }

  for (const link of input.links ?? []) {
    const from = repOf(link.fromId);
    const to = repOf(link.toId);
    if (from && to) addEdge(from, to, "relates");
  }

  // Hulls for groups that are not folded and not swallowed by a folded group.
  const expandVisible = (group: ResearchSummaryGroup, out: Set<string>, trail: Set<string>) => {
    if (trail.has(group.id)) return;
    trail.add(group.id);
    for (const memberId of group.memberIds) {
      const inner = groupBySummary.get(memberId);
      if (inner && !folded.has(inner.id)) {
        expandVisible(inner, out, trail);
        continue;
      }
      const rep = repOf(memberId);
      if (rep) out.add(rep);
    }
  };
  const hullGroups = groups.filter((group) => !folded.has(group.id) && !owner.has(group.summaryCardId));
  const hullMembers = new Map(
    hullGroups.map((group) => {
      const out = new Set<string>();
      expandVisible(group, out, new Set());
      return [group.id, out] as const;
    }),
  );
  const hulls: FoldHull[] = hullGroups
    .map((group) => {
      const members = hullMembers.get(group.id)!;
      const innerCount = hullGroups.filter((other) => {
        if (other.id === group.id) return false;
        const otherMembers = hullMembers.get(other.id)!;
        return otherMembers.size > 0 && otherMembers.size < members.size && [...otherMembers].every((id) => members.has(id));
      }).length;
      return {
        groupId: group.id,
        summaryCard: cardsById.get(group.summaryCardId)!,
        status: group.status,
        memberNodeIds: [...members],
        innerCount,
      };
    })
    .filter((hull) => hull.memberNodeIds.length > 0);

  // Siblings: members of the same hull sit together, then agent order.
  const clusterOf = new Map<string, number>();
  hulls.forEach((hull, index) => {
    for (const id of hull.memberNodeIds) if (!clusterOf.has(id)) clusterOf.set(id, index);
  });
  const children = new Map<string | null, string[]>();
  for (const node of nodes) {
    const key = parent.get(node.id) ?? null;
    const list = children.get(key) ?? [];
    list.push(node.id);
    children.set(key, list);
  }
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  for (const list of children.values()) {
    list.sort((a, b) => {
      const ca = clusterOf.get(a) ?? Number.MAX_SAFE_INTEGER;
      const cb = clusterOf.get(b) ?? Number.MAX_SAFE_INTEGER;
      if (ca !== cb) return ca - cb;
      const na = nodeById.get(a)!;
      const nb = nodeById.get(b)!;
      const sa = sortKey.get(a) ?? na.card.sortOrder;
      const sb = sortKey.get(b) ?? nb.card.sortOrder;
      return sa - sb || na.card.createdAt.localeCompare(nb.card.createdAt);
    });
  }

  const rep = new Map<string, string>();
  for (const card of input.cards) {
    const value = repOf(card.id);
    if (value) rep.set(card.id, value);
  }

  return { nodes, parent, children, edges, hulls, rep, maxLevel };
};

/** Zoom thresholds: below each scale, one more summary layer folds. */
export const FOLD_THRESHOLDS = [0.75, 0.45, 0.3, 0.22] as const;

export const levelForScale = (scale: number, maxLevel: number) =>
  Math.min(maxLevel, FOLD_THRESHOLDS.filter((threshold) => scale < threshold).length);

/** A scale comfortably inside the band for `level`, used by the level buttons. */
export const scaleForLevel = (level: number) => {
  if (level <= 0) return 1;
  const upper = FOLD_THRESHOLDS[level - 1] ?? 0.22;
  const lower = FOLD_THRESHOLDS[level] ?? 0.2;
  return (upper + lower) / 2;
};
