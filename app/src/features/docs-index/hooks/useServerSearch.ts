import { createResource, type Accessor } from "solid-js";
import { useDebouncedSignal } from "./useDebouncedSignal";
import { useAbortableFetch } from "./useAbortableFetch";
import { searchDocs } from "../data/docs.service";

type Filters = {
  pathPrefix?: string;
  metaKey?: string;
  metaValue?: string;
  source?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
};

export function useServerSearch(
  qSig: Accessor<string>,
  filters: Accessor<Filters>
) {
  const debounced = useDebouncedSignal(qSig, { leadMs: 100, trailMs: 500 });
  const { withAbort, abort } = useAbortableFetch();

  const [results, { refetch }] = createResource(
    () => ({ q: debounced(), f: filters() }),
    ({ q, f }) => {
      if (!q?.trim()) return Promise.resolve([]);
      return withAbort((signal) => searchDocs({ q, ...f, signal }));
    }
  );

  return { results, abort, loading: results.loading, refetch };
}
