type Timers = {
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number | undefined) => void;
  now: () => number;
};

/**
 * Collects query keys and flushes them once events stop for `debounceMs`,
 * but never later than `maxWaitMs` after the first pending key. A steady
 * stream of events still refreshes about once per `maxWaitMs`.
 */
export function createRefreshBatcher(options: {
  debounceMs: number;
  maxWaitMs: number;
  flush: (keys: string[]) => void;
  timers?: Timers;
}) {
  const timers: Timers = options.timers ?? {
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id),
    now: () => Date.now(),
  };
  const pending = new Set<string>();
  let timer: number | undefined;
  let firstAt: number | null = null;

  const flush = () => {
    timers.clearTimeout(timer);
    timer = undefined;
    firstAt = null;
    if (pending.size === 0) return;
    const keys = [...pending];
    pending.clear();
    options.flush(keys);
  };

  return {
    add(keys: readonly string[]) {
      if (keys.length === 0) return;
      for (const key of keys) pending.add(key);
      const now = timers.now();
      firstAt ??= now;
      const wait = Math.min(
        options.debounceMs,
        Math.max(0, firstAt + options.maxWaitMs - now),
      );
      timers.clearTimeout(timer);
      timer = timers.setTimeout(flush, wait);
    },
    cancel() {
      timers.clearTimeout(timer);
      timer = undefined;
      firstAt = null;
      pending.clear();
    },
  };
}
