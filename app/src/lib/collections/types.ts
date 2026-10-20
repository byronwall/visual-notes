// Shared, isomorphic collection types. Imported by the server, the client,
// and scripts, so nothing here may depend on the UI or Prisma.

export const PROPERTY_KINDS = [
  "text",
  "number",
  "select",
  "status",
  "multi_select",
  "date",
  "checkbox",
  "created_time",
  "updated_time",
] as const;
export type PropertyKind = (typeof PROPERTY_KINDS)[number];

export const TEXT_FORMATS = ["plain", "url", "email", "phone"] as const;
export type TextFormat = (typeof TEXT_FORMATS)[number];

export const NUMBER_FORMATS = [
  "plain",
  "decimal",
  "percent",
  "currency",
  "rating",
  "progress",
] as const;
export type NumberFormat = (typeof NUMBER_FORMATS)[number];

export const STATUS_GROUPS = ["todo", "doing", "done"] as const;
export type StatusGroup = (typeof STATUS_GROUPS)[number];

export const OPTION_COLORS = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const;
export type OptionColor = (typeof OPTION_COLORS)[number];

export type SelectOption = {
  id: string;
  name: string;
  color: OptionColor;
  /** Status properties only: which of the three fixed groups this option is in. */
  group?: StatusGroup;
};

export type PropertyConfig = {
  format?: TextFormat | NumberFormat;
  options?: SelectOption[];
  /** Number: digits after the decimal point for decimal/currency/percent. */
  decimals?: number;
  /** Number currency format: ISO code, e.g. USD. */
  currency?: string;
  /** Number rating format: maximum stars. */
  ratingMax?: number;
  /** Date: show and edit a time of day. */
  includeTime?: boolean;
};

export type CollectionProperty = {
  id: string;
  name: string;
  kind: PropertyKind;
  config: PropertyConfig;
  position: number;
};

/**
 * Dates are wall-clock strings with no time zone: `YYYY-MM-DD` or
 * `YYYY-MM-DDTHH:mm`. They render identically on the server and the client.
 */
export type DateValue = { start: string; end?: string | null };

export type PropertyValue =
  | string
  | number
  | boolean
  | string[]
  | DateValue
  | null;

/** Stored on `Doc.properties`, keyed by property id. */
export type RowProperties = Record<string, PropertyValue>;

export type CollectionRow = {
  id: string;
  title: string;
  properties: RowProperties;
  rank: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Pseudo property id for the note title, always the first column. */
export const TITLE_PROPERTY_ID = "title";

export const VIEW_TYPES = ["table", "board", "gallery", "calendar"] as const;
export type ViewType = (typeof VIEW_TYPES)[number];

export type FilterCondition = {
  id: string;
  propertyId: string;
  op: FilterOperator;
  value?: unknown;
};

export type FilterGroup = {
  id: string;
  conjunction: "and" | "or";
  conditions: FilterCondition[];
};

export type FilterTree = {
  conjunction: "and" | "or";
  items: Array<FilterCondition | FilterGroup>;
};

export const FILTER_OPERATORS = [
  "contains",
  "not_contains",
  "is",
  "is_not",
  "starts_with",
  "is_empty",
  "is_not_empty",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "any_of",
  "none_of",
  "contains_all",
  "group_is",
  "before",
  "after",
  "on_or_before",
  "on_or_after",
  "past_days",
  "next_days",
  "this_week",
  "this_month",
  "is_checked",
  "is_unchecked",
] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export type SortRule = { propertyId: string; direction: "asc" | "desc" };

export const AGGREGATIONS = [
  "none",
  "count",
  "count_empty",
  "count_not_empty",
  "percent_not_empty",
  "sum",
  "avg",
  "min",
  "max",
  "checked",
  "percent_checked",
] as const;
export type Aggregation = (typeof AGGREGATIONS)[number];

export type CoverSource = { source: "none" | "body" | "property"; propertyId?: string };

export type ViewConfig = {
  filter?: FilterTree;
  sorts?: SortRule[];
  search?: string;
  /** Property ids in display order. Missing ids are appended by position. */
  propertyOrder?: string[];
  hiddenProperties?: string[];
  columnWidths?: Record<string, number>;
  aggregations?: Record<string, Aggregation>;
  /** Board: select/status property to group by. */
  groupBy?: string;
  /** Board: option ids hidden from the board. */
  hiddenGroups?: string[];
  /** Board and gallery: property ids shown on cards. */
  cardProperties?: string[];
  cover?: CoverSource;
  /** Calendar: date property that places rows. */
  dateProperty?: string;
};

export type CollectionView = {
  id: string;
  collectionId: string;
  hostDocId: string | null;
  name: string;
  type: ViewType;
  config: ViewConfig;
  position: number;
};

export type CollectionSummary = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
};

export type CollectionBundle = {
  collection: CollectionSummary;
  properties: CollectionProperty[];
  views: CollectionView[];
  rows: CollectionRow[];
  /** Server's local date (YYYY-MM-DD) so relative date filters agree on SSR and hydration. */
  today: string;
};
