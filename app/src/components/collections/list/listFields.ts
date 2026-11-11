import { orderedProperties } from "~/lib/collections/query";
import type {
  CollectionProperty,
  ViewConfig,
} from "~/lib/collections/types";

const DEFAULT_COUNT = 3;
const MAX_COUNT = 4;

/** Short values read best in one line; long text and timestamps come last. */
const rank = (p: CollectionProperty) => {
  switch (p.kind) {
    case "status":
    case "select":
    case "date":
    case "number":
    case "checkbox":
      return 0;
    case "multi_select":
      return 1;
    case "text":
      return (p.config.format ?? "plain") === "plain" ? 2 : 1;
    default:
      return 3;
  }
};

/**
 * The labelled values under each record's name: the view's card properties
 * when it has them, else the three shortest-reading visible properties. Both
 * keep the view's column order.
 */
export const listFields = (
  properties: CollectionProperty[],
  config: ViewConfig,
): CollectionProperty[] => {
  const chosen = config.cardProperties;
  if (chosen)
    return orderedProperties(properties, config, { includeHidden: true })
      .filter((p) => chosen.includes(p.id))
      .slice(0, MAX_COUNT);
  const visible = orderedProperties(properties, config);
  const picked = new Set(
    visible
      .map((p, i) => ({ p, i }))
      .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
      .slice(0, DEFAULT_COUNT)
      .map(({ p }) => p.id),
  );
  return visible.filter((p) => picked.has(p.id));
};

// Keep in step with ListRow's styles: padding, two title lines, field lines.
const PAD_Y = 10;
const TITLE_LINE = 20;
const FIELD_GAP = 4;
const FIELD_LINE = 20;

/** Every record is this tall, so the list can window by arithmetic. */
export const listRowHeight = (fieldCount: number) =>
  PAD_Y * 2 +
  TITLE_LINE * 2 +
  (fieldCount ? FIELD_GAP + fieldCount * FIELD_LINE : 0) +
  1; // bottom border
