// Relationship types. Directed types read "from is <label> of to"; the other
// side sees the inverse label. Symmetric types read the same both ways.

export type RelationshipType = {
  label: string;
  /** What the "to" person sees; absent for symmetric types. */
  inverse?: string;
};

export const RELATIONSHIP_TYPES = {
  friend: { label: "Friend" },
  partner: { label: "Partner or spouse" },
  sibling: { label: "Sibling" },
  relative: { label: "Relative" },
  colleague: { label: "Colleague" },
  classmate: { label: "Classmate" },
  neighbor: { label: "Neighbor" },
  knows: { label: "Knows" },
  parent: { label: "Parent of", inverse: "Child of" },
  mentor: { label: "Mentor of", inverse: "Mentee of" },
  manager: { label: "Manager of", inverse: "Reports to" },
  introduced: { label: "Introduced me to", inverse: "Introduced by" },
} satisfies Record<string, RelationshipType>;

export type RelationshipKind = keyof typeof RELATIONSHIP_TYPES;
export const RELATIONSHIP_KINDS = Object.keys(
  RELATIONSHIP_TYPES,
) as RelationshipKind[];

export const isDirected = (type: RelationshipKind) =>
  "inverse" in RELATIONSHIP_TYPES[type];

/** Symmetric pairs store the lower id first, so a pair has one edge per type. */
export function normalizeEdge(
  type: RelationshipKind,
  from: string,
  to: string,
) {
  if (from === to)
    throw new Error("Invalid relationship: a person cannot relate to themself");
  return isDirected(type) || from < to ? { from, to } : { from: to, to: from };
}

/** The label as seen from `viewerId`'s side of the edge. */
export function labelFor(
  type: RelationshipKind,
  edge: { fromPersonId: string },
  viewerId: string,
): string {
  const t: RelationshipType = RELATIONSHIP_TYPES[type];
  return t.inverse && edge.fromPersonId !== viewerId ? t.inverse : t.label;
}
