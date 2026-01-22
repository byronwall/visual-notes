import { createResource, type Accessor } from "solid-js";
import { useDebouncedSignal } from "./useDebouncedSignal";
import { searchDocs } from "../data/docs.service";

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
  filters: Accessor<Filters>
) {
  const debounced = useDebouncedSignal(qSig, { leadMs: 100, trailMs: 500 });
  const [results, { refetch }] = createResource(
    () => ({ q: debounced(), f: filters() }),
    ({ q, f }) => {
      if (!q?.trim()) return Promise.resolve([]);
      return searchDocs({ q, ...f });
    }
  );

  return { results, loading: results.loading, refetch };
}
