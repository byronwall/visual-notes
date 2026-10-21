/** Things the sidebar can list as recently visited or edited. */
export type RecentKind = "note" | "collection" | "research" | "tag" | "path";

export const RECENT_KINDS: readonly RecentKind[] = [
  "note",
  "collection",
  "research",
  "tag",
  "path",
];

/** Kinds logged by `logRecentView`; notes log `doc.view` on their own. */
export type RecentViewKind = Exclude<RecentKind, "note">;

export type RecentItem = {
  kind: RecentKind;
  /** Doc id, collection id, research slug, tag name, or dot path. */
  id: string;
  title: string;
  href: string;
  /** Latest visit or edit, ISO string. */
  at: string;
  /** Collection emoji, when one is set. */
  icon?: string | null;
  /** Notes only: fields the hover preview needs. */
  path?: string | null;
  meta?: Record<string, unknown> | null;
  updatedAt?: string;
};
