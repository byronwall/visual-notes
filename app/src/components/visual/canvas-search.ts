import type { DocItem } from "~/types/notes";

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
