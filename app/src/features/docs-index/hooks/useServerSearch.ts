import { createSignal, createEffect, onCleanup, type Accessor } from "solid-js";
import { useDebouncedSignal } from "./useDebouncedSignal";
import { searchDocs } from "../data/docs.service";
import type { ServerSearchItem } from "../data/docs.types";

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
      setLoading(false);
      return;
    }

    const requestId = ++requestSeq;
    latestRequestId = requestId;
    inFlight.add(requestId);
    setLoading(true);

    const startMs = Date.now();
    const slowTimer = window.setTimeout(() => {
      console.log("[useServerSearch] slow request", {
        requestId,
        q,
        elapsedMs: Date.now() - startMs,
        inFlight: inFlight.size,
      });
    }, 2000);

    let disposed = false;
    onCleanup(() => {
      disposed = true;
      window.clearTimeout(slowTimer);
    });

    searchDocs({ q, ...f, take: resolvedTake })
      .then((items) => {
        inFlight.delete(requestId);
        window.clearTimeout(slowTimer);
        const elapsedMs = Date.now() - startMs;

        if (disposed || requestId !== latestRequestId) {
          return;
        }

        console.log("[useServerSearch] resolve", {
          requestId,
          elapsedMs,
          count: items.length,
        });
        setResults(items);
        setLoading(false);
      })
      .catch((err: unknown) => {
        inFlight.delete(requestId);
        window.clearTimeout(slowTimer);
        const elapsedMs = Date.now() - startMs;

        if (disposed || requestId !== latestRequestId) return;

        console.error("[useServerSearch] request failed", {
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
