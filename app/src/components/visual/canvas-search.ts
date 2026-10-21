import type { DocItem } from "~/types/notes";

/** "all" searches every note on the canvas; "region" stays inside the open region. */
export type CanvasSearchScope = "all" | "region";

/** Reads the `scope` URL param; anything but "region" means global search. */
export function parseCanvasSearchScope(
  value: string | undefined,
): CanvasSearchScope {
  return value === "region" ? "region" : "all";
}

export function normalizeCanvasQuery(query: string) {
  return query.trim().toLowerCase();
}

/** Canvas search matches a note's title or its path. */
export function docMatchesCanvasQuery(doc: DocItem, normalizedQuery: string) {
  if (!normalizedQuery) return true;
  return (
    doc.title.toLowerCase().includes(normalizedQuery) ||
    (doc.path?.toLowerCase().includes(normalizedQuery) ?? false)
  );
}

/**
 * Notes matching the query, limited to `scopeDocIds` when given.
 * Returns null when there is no query, so callers can tell "not searching"
 * apart from "no matches".
 */
export function matchCanvasDocs(
  docs: readonly DocItem[],
  normalizedQuery: string,
  scopeDocIds?: ReadonlySet<string> | null,
): DocItem[] | null {
  if (!normalizedQuery) return null;
  return docs.filter(
    (doc) =>
      (!scopeDocIds || scopeDocIds.has(doc.id)) &&
      docMatchesCanvasQuery(doc, normalizedQuery),
  );
}

export function canvasSearchPlaceholder(regionTitle: string | null) {
  return regionTitle ? `Search in ${regionTitle}` : "Search all notes";
}

export function canvasMatchCountLabel(count: number, scopedToRegion: boolean) {
  const n = count.toLocaleString();
  if (scopedToRegion) return `${n} in region`;
  return `${n} ${count === 1 ? "match" : "matches"}`;
}
