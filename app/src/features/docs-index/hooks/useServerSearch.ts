import { createSignal, createEffect, onCleanup, type Accessor } from "solid-js";
import { useDebouncedSignal } from "./useDebouncedSignal";
import { searchDocs } from "../data/docs.service";
import type { ServerSearchItem } from "../data/docs.types";

const SEARCH_LOG_PREFIX = "[docs-index/search]";
const REQUEST_TIMEOUT_MS = 15_000;

type Filters = {
  pathPrefix?: string;
  blankPathOnly?: boolean;
  metaKey?: string;
  metaValue?: string;
  source?: string;
  originalContentId?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  activityClass?: "READ_HEAVY" | "EDIT_HEAVY" | "BALANCED" | "COLD";
  sortMode?:
    | "relevance"
    | "recent_activity"
    | "most_viewed_30d"
    | "most_edited_30d";
};

export function useServerSearch(
  qSig: Accessor<string>,
  filters: Accessor<Filters>,
  take?: Accessor<number>,
) {
  const debounced = useDebouncedSignal(qSig, { leadMs: 100, trailMs: 500 });
  const [results, setResults] = createSignal<ServerSearchItem[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [reloadTick, setReloadTick] = createSignal(0);

  let requestSeq = 0;
  let latestRequestId = 0;
  const inFlight = new Set<number>();

  createEffect(() => {
    void reloadTick();
    const q = debounced().trim();
    const f = filters();
    const resolvedTake = take ? take() : undefined;
    if (!q) {
      setResults((prev) => {
        if (prev.length > 0) return [];
        return prev;
      });
      latestRequestId = 0;
      inFlight.clear();
      setLoading(false);
      return;
    }

    const requestId = ++requestSeq;
    latestRequestId = requestId;
    inFlight.add(requestId);
    setLoading(true);

    const startMs = Date.now();
    const slowTimer = setTimeout(() => {
      console.info(`${SEARCH_LOG_PREFIX} slow`, {
        requestId,
        q,
        elapsedMs: Date.now() - startMs,
        inFlight: inFlight.size,
      });
    }, 2000);
    const timeoutTimer = setTimeout(() => {
      inFlight.delete(requestId);
      const elapsedMs = Date.now() - startMs;
      if (requestId !== latestRequestId) {
        return;
      }
      console.warn(`${SEARCH_LOG_PREFIX} timeout`, {
        requestId,
        elapsedMs,
        timeoutMs: REQUEST_TIMEOUT_MS,
        q,
        inFlight: inFlight.size,
      });
      setLoading(false);
    }, REQUEST_TIMEOUT_MS);
    console.info(`${SEARCH_LOG_PREFIX} start`, {
      requestId,
      q,
      take: resolvedTake ?? null,
      hasFilters: Object.values(f).some(
        (value) => value !== undefined && value !== "" && value !== false,
      ),
    });

    let disposed = false;
    onCleanup(() => {
      disposed = true;
      clearTimeout(slowTimer);
      clearTimeout(timeoutTimer);
    });

    searchDocs({ q, ...f, take: resolvedTake })
      .then((items) => {
        inFlight.delete(requestId);
        clearTimeout(slowTimer);
        clearTimeout(timeoutTimer);
        const elapsedMs = Date.now() - startMs;

        if (disposed || requestId !== latestRequestId) {
          return;
        }

        console.info(`${SEARCH_LOG_PREFIX} resolve`, {
          requestId,
          elapsedMs,
          count: items.length,
        });
        setResults(items);
        setLoading(false);
      })
      .catch((err: unknown) => {
        inFlight.delete(requestId);
        clearTimeout(slowTimer);
        clearTimeout(timeoutTimer);
        const elapsedMs = Date.now() - startMs;

        if (disposed || requestId !== latestRequestId) return;

        console.error(`${SEARCH_LOG_PREFIX} request failed`, {
          requestId,
          elapsedMs,
          inFlight: inFlight.size,
          err,
        });
        setLoading(false);
      });
  });

  const refetch = () => {
    setReloadTick((x) => x + 1);
  };

  return { results, loading, refetch };
}
