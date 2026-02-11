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
    console.log("[useServerSearch] effect", { q, take: resolvedTake });

    if (!q) {
      setResults((prev) => {
        if (prev.length > 0) {
          console.log("[useServerSearch] clear results for empty query");
          return [];
        }
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
    console.log("[useServerSearch] start", {
      requestId,
      q,
      take: resolvedTake,
      inFlight: inFlight.size,
      filters: f,
    });

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
      console.log("[useServerSearch] cleanup", {
        requestId,
        latestRequestId,
        inFlight: inFlight.size,
      });
    });

    searchDocs({ q, ...f, take: resolvedTake })
      .then((items) => {
        inFlight.delete(requestId);
        window.clearTimeout(slowTimer);
        const elapsedMs = Date.now() - startMs;

        if (disposed || requestId !== latestRequestId) {
          console.log("[useServerSearch] stale response ignored", {
            requestId,
            latestRequestId,
            elapsedMs,
            count: items.length,
            inFlight: inFlight.size,
          });
          return;
        }

        console.log("[useServerSearch] resolve", {
          requestId,
          elapsedMs,
          count: items.length,
          inFlight: inFlight.size,
        });
        setResults(items);
        setLoading(false);
      })
      .catch((err: unknown) => {
        inFlight.delete(requestId);
        window.clearTimeout(slowTimer);
        const elapsedMs = Date.now() - startMs;

        if (disposed || requestId !== latestRequestId) {
          console.log("[useServerSearch] stale error ignored", {
            requestId,
            latestRequestId,
            elapsedMs,
            inFlight: inFlight.size,
          });
          return;
        }

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
    console.log("[useServerSearch] manual refetch");
    setReloadTick((x) => x + 1);
  };

  return { results, loading, refetch };
}
