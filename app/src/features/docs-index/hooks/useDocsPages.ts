import { revalidate } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  on,
  untrack,
  type Accessor,
} from "solid-js";
import { fetchDocs, fetchDocsSummary } from "../data/docs.service";
import type { DocListItem } from "../data/docs.types";
import { createKeptAsync } from "~/utils/kept-async";

export const DOCS_PAGE_SIZE = 100;

type ListArgs = Omit<Parameters<typeof fetchDocs>[0], "take" | "skip">;

/**
 * Loads the browse list 100 rows at a time. The first page is an SSR query,
 * so the first paint carries only those rows; later pages are fetched on
 * demand and appended, so rows on screen never unmount while one loads.
 */
export function useDocsPages(args: {
  filters: Accessor<ListArgs>;
  /** Rows the URL asks for (`clientShown`), restored after a reload. */
  shown: Accessor<number>;
  setShown: (n: number) => void;
}) {
  const filterKey = () => JSON.stringify(args.filters());
  // The filters the rows on screen answer; lets the list dim while new ones
  // load. Seeded because hydration reuses the server's rows without a fetch.
  const [loadedKey, setLoadedKey] = createSignal(untrack(filterKey));
  const firstPage = createKeptAsync(async () => {
    const key = filterKey();
    const filters = args.filters();
    try {
      return await fetchDocs({ ...filters, skip: 0, take: DOCS_PAGE_SIZE });
    } finally {
      setLoadedKey(key);
    }
  });
  const summary = createKeptAsync(() => {
    const { sortMode, ...filters } = args.filters();
    void sortMode;
    return fetchDocsSummary(filters);
  });

  const [extra, setExtra] = createSignal<DocListItem[]>([]);
  const [loadingMore, setLoadingMore] = createSignal(false);
  // Bumped on every filter change so a slow page cannot land in a new list.
  let generation = 0;

  createEffect(
    on(
      filterKey,
      () => {
        generation++;
        setExtra([]);
        setLoadingMore(false);
        args.setShown(DOCS_PAGE_SIZE);
      },
      { defer: true },
    ),
  );

  const items = createMemo<DocListItem[] | undefined>(() => {
    const first = firstPage.latest;
    if (!first) return undefined;
    const seen = new Set<string>();
    const out: DocListItem[] = [];
    // Offset pages can overlap when a note moves between requests.
    for (const item of [...first, ...extra()]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    return out;
  });

  const total = () => summary.latest?.total;
  const loadedCount = () =>
    (firstPage.latest?.length ?? 0) + untrack(extra).length;

  const fetchRange = async (skip: number, take: number) => {
    const gen = generation;
    const rows = await fetchDocs({ ...untrack(args.filters), skip, take });
    return gen === generation ? rows : undefined;
  };

  const showMore = async () => {
    if (loadingMore() || !firstPage.latest) return;
    const loaded = loadedCount();
    const t = total();
    if (t !== undefined && loaded >= t) return;
    setLoadingMore(true);
    try {
      const rows = await fetchRange(loaded, DOCS_PAGE_SIZE);
      if (!rows) return;
      setExtra((prev) => [...prev, ...rows]);
      // Keep a larger target from the URL so the refill below continues.
      args.setShown(Math.max(untrack(args.shown), loaded + rows.length));
    } catch (err) {
      console.error("[docs-index] load more failed", err);
    } finally {
      setLoadingMore(false);
    }
  };

  // After a reload or back navigation, refill up to the rows the URL asked
  // for so the scroll position has something to land on.
  createEffect(() => {
    if (!firstPage.latest || loadingMore()) return;
    const want = args.shown();
    const loaded = loadedCount();
    const t = total() ?? Infinity;
    if (want > loaded && loaded < t) void showMore();
  });

  const refresh = async () => {
    await revalidate([fetchDocs.key, fetchDocsSummary.key]);
    const count = untrack(extra).length;
    if (count === 0) return;
    const rows = await fetchRange(DOCS_PAGE_SIZE, count);
    if (rows) setExtra(rows);
  };

  const stale = () => loadedKey() !== filterKey();

  return { items, summary, stale, loadingMore, showMore, refresh };
}
