export type MetaRecord = Record<string, string | number | boolean | null>;

export type DocListItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  path?: string | null;
  meta?: MetaRecord | null;
  share?: {
    slug: string;
    shareUrl: string;
  } | null;
  /** Set when the note is a row in a collection. */
  collection?: { id: string; name: string; icon: string | null } | null;
};

export type ActivityClass = "READ_HEAVY" | "EDIT_HEAVY" | "BALANCED" | "COLD";

export type SortMode =
  | "relevance"
  | "recent_activity"
  | "most_viewed_30d"
  | "most_edited_30d";

export type DocsFilters = {
  pathPrefix?: string;
  pathBlankOnly?: boolean;
  metaKey?: string;
  metaValue?: string;
  source?: string;
  originalContentId?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  /** Rolling window; wins over `updatedFrom`/`updatedTo`. */
  updatedWithinDays?: number;
  activityClass?: ActivityClass;
  /**
   * Unset hides rows of collections without `showRowsInRecent`, the same rule
   * as the sidebar Recent list. "all" adds them; "only" shows nothing else.
   */
  collectionRows?: "all" | "only";
  /** Rows of one collection; wins over `collectionRows`. */
  collectionId?: string;
};

export type FacetCount = { value: string; count: number };

export type DocsFacets = {
  /** Children of the current path, or top-level segments without one. */
  paths: FacetCount[];
  /** Notes with no path; only counted at the top level. */
  blankPaths: number;
  sources: FacetCount[];
  activity: FacetCount[];
  metaKeys: FacetCount[];
  /** Values of the selected meta key. */
  metaValues: FacetCount[];
  collections: (FacetCount & { name: string; icon: string | null })[];
  updated: { days: number; count: number }[];
  /** Rows the default scope leaves out, for the toggle and its hints. */
  hiddenCollectionRows: number;
};

export type DocsSummary = {
  total: number;
  /** Matches per `updatedBucket` key. */
  bucketCounts: Record<string, number>;
  /** Server clock, so relative times and headings match across hydration. */
  nowMs: number;
  facets: DocsFacets;
};

export type ServerSearchItem = DocListItem & { snippet?: string | null };

export type SourcesResponse = {
  total: number;
  sources: { originalSource: string; count: number }[];
};

export type ScanRelativeImagesResult = {
  ok: boolean;
  total: number;
  considered: number;
  matches: number;
  updated?: number;
  failed?: number;
  dryRun?: boolean;
  readFailures?: number;
};

export type BulkMetaAction =
  | { type: "add"; key: string; value: string | number | boolean | null }
  | { type: "update"; key: string; value: string | number | boolean | null }
  | { type: "remove"; key: string };
