/** Things the sidebar can list as recently created or edited. */
export type RecentKind = "note" | "collection" | "research";

export type RecentItem = {
  kind: RecentKind;
  /** Doc id, collection id, or research slug. */
  id: string;
  title: string;
  href: string;
  /** Latest create or edit, ISO string. */
  at: string;
  /** Collection emoji, when one is set. */
  icon?: string | null;
  /** Notes only: fields the hover preview needs. */
  path?: string | null;
  meta?: Record<string, unknown> | null;
  updatedAt?: string;
};
