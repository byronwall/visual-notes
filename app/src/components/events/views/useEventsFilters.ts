import { useSearchParams } from "@solidjs/router";
import { createMemo } from "solid-js";
import {
  filtersToParams,
  parseEventsFilters,
  type EventsFilters,
} from "~/lib/events/filters";

/** URL-backed event filters shared by the list, calendar, and map. */
export const useEventsFilters = () => {
  const [params, setParams] = useSearchParams();
  const filters = createMemo(() => parseEventsFilters(params));
  const update = (patch: Partial<EventsFilters>) =>
    setParams(filtersToParams(patch), { replace: true });
  const clear = () =>
    update({ collection: "all", decisions: [], past: false, q: "" });
  return { params, setParams, filters, update, clear };
};

export type EventsFiltersApi = ReturnType<typeof useEventsFilters>;
