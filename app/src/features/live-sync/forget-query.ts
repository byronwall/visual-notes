import { revalidate } from "@solidjs/router";

type HydrationGlobal = { _$HY?: { r?: Record<string, unknown> } };

/**
 * Makes the next call of these queries read the server. `revalidate` clears
 * the router's cache, but a query first called after hydration is answered
 * from the SSR payload (`_$HY.r`) instead, which is stale once someone else
 * changed the data. A resource that refetches on an `app:changed` event
 * calls this first.
 */
export const forgetQuery = async (keys: string[]) => {
  const hydrated = (globalThis as HydrationGlobal)._$HY?.r;
  if (hydrated) {
    for (const key of Object.keys(hydrated)) {
      if (keys.some((prefix) => key.startsWith(prefix))) delete hydrated[key];
    }
  }
  await revalidate(keys, true);
};
