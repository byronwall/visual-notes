import { createMemo, createResource, type Accessor } from "solid-js";
import { fetchDocPreviewsBatched } from "~/services/docs.service";
import type { PathNote } from "../utils/path-notes";

const NO_PREVIEW = "No preview available.";

/**
 * Snippets for the visible note rows. Fetches only ids it has not seen yet, so
 * "Show more" and filter changes do not refetch rows already on screen, and
 * looks rows up in O(1) instead of scanning the batch per row.
 */
export const usePathNotePreviews = (visible: Accessor<PathNote[]>) => {
  // Plain cache: rows re-read it whenever the resource below settles.
  const cache = new Map<string, string | undefined>();

  const missingKey = createMemo(() =>
    visible()
      .filter((note) => !cache.has(note.id))
      .map((note) => note.id)
      .join(","),
  );

  const [batch] = createResource(missingKey, async (key) => {
    const ids = key.split(",");
    const items = await fetchDocPreviewsBatched(ids);
    // Remember ids with no preview too, so they are not requested again.
    for (const id of ids) if (!cache.has(id)) cache.set(id, undefined);
    return items;
  });

  // Fold every settled batch into the cache. This also covers the batch that
  // arrives with SSR hydration, where the fetcher above never runs on the client.
  const settled = createMemo(() => {
    const items = batch.latest ?? [];
    for (const item of items) cache.set(item.id, item.previewText);
    return items;
  });

  // Read inside each row's Suspense so slow previews never hold back the list.
  const previewFor = (note: PathNote) => {
    settled();
    const text = cache.get(note.id);
    if (!text || text === NO_PREVIEW) return undefined;
    // Most notes open with their title as an H1; skip it so the snippet adds information.
    const title = (note.title || "").trim();
    const body = title && text.startsWith(title) ? text.slice(title.length).trim() : text;
    return body || undefined;
  };

  return previewFor;
};
