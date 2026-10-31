import { revalidate } from "@solidjs/router";
import { createResource, createSignal, onMount } from "solid-js";
import { fetchCleanupStatus } from "~/services/cleanup/cleanup.queries";

/**
 * A draft that may cost money. When free it runs as soon as `key` is set; when
 * `paid()` it waits for `ask()`, so opening or passing over a note spends
 * nothing. Runs only in the browser: never during SSR.
 */
export function useOnDemand<T>(opts: {
  /** Identifies what would be drafted; false when there is nothing to do. */
  key: () => string | false;
  paid: () => boolean;
  run: (key: string) => Promise<T>;
}) {
  const [mounted, setMounted] = createSignal(false);
  onMount(() => setMounted(true));
  const [asked, setAsked] = createSignal<string | null>(null);
  const source = () => {
    const key = opts.key();
    if (!mounted() || !key) return false;
    return !opts.paid() || asked() === key ? key : false;
  };
  const [result, { refetch }] = createResource(source, async (key) => {
    const value = await opts.run(key);
    if (opts.paid()) void revalidate(fetchCleanupStatus.key);
    return { key, value };
  });
  /** The result for the current key only, never the previous note's. */
  const value = () => {
    if (result.error) return undefined;
    const latest = result.latest;
    return latest && latest.key === opts.key() ? latest.value : undefined;
  };
  const failed = () => Boolean(result.error);
  /** Paid and not asked for yet: show the button, not a skeleton. */
  const idle = () =>
    opts.paid() && !value() && !result.loading && !failed() && !source();
  return {
    value,
    failed,
    idle,
    loading: () => !idle() && (!mounted() || result.loading),
    /** Writes the draft, or a new one when there already is one. */
    ask: () => {
      const key = opts.key();
      if (!key) return;
      if (!opts.paid() || asked() === key) void refetch();
      else setAsked(key);
    },
  };
}
