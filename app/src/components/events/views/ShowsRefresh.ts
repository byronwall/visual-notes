import { createContext, useContext } from "solid-js";

/**
 * Refetches the shows a view holds. `createResource` does not follow action
 * revalidation, so rows that write (the decision menu) call this after saving.
 */
export const ShowsRefreshContext = createContext<() => Promise<unknown>>(
  async () => undefined,
);

export const useShowsRefresh = () => useContext(ShowsRefreshContext);
