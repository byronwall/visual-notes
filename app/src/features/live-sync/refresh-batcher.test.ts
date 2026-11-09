import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRefreshBatcher } from "./refresh-batcher";

describe("createRefreshBatcher", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = () => {
    const flushed: string[][] = [];
    const batcher = createRefreshBatcher({
      debounceMs: 250,
      maxWaitMs: 1_000,
      flush: (keys) => flushed.push(keys),
      timers: {
        setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
        clearTimeout: (id) => clearTimeout(id),
        now: () => Date.now(),
      },
    });
    return { batcher, flushed };
  };

  it("folds a burst into one refresh of every key", () => {
    const { batcher, flushed } = make();
    batcher.add(["docs-"]);
    vi.advanceTimersByTime(100);
    batcher.add(["docs-", "sidebar-recent-items"]);
    vi.advanceTimersByTime(249);
    expect(flushed).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(flushed).toEqual([["docs-", "sidebar-recent-items"]]);
  });

  it("still refreshes while an agent writes without pause", () => {
    const { batcher, flushed } = make();
    for (let i = 0; i < 10; i++) {
      batcher.add(["docs-"]);
      vi.advanceTimersByTime(200);
    }
    // 2s of events 200ms apart: the debounce alone would never fire.
    expect(flushed.length).toBeGreaterThanOrEqual(2);
  });
});
