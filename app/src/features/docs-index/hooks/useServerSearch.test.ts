import { createRoot, createSignal } from "solid-js";
import type * as Solid from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { searchDocs } from "../data/docs.service";
import { useServerSearch } from "./useServerSearch";

vi.mock("solid-js", () =>
  vi.importActual<typeof Solid>("solid-js/dist/solid.js"),
);
vi.mock("../data/docs.service", () => ({ searchDocs: vi.fn() }));

const filters = () => ({ pathBlankOnly: true });

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe("useServerSearch request outcomes", () => {
  it("exposes rejection for a failed query", async () => {
    const recovered = [
      { id: "recovered", title: "Recovered", createdAt: "", updatedAt: "" },
    ];
    vi.mocked(searchDocs)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(recovered);
    let dispose!: () => void;
    const state = createRoot((stop) => {
      dispose = stop;
      return useServerSearch(() => "broken", filters);
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(state.results()).toEqual([]);
    expect(state.error()).toBe("request");
    expect(state.loading()).toBe(false);
    expect(vi.mocked(searchDocs).mock.calls[0]?.[0]).toMatchObject({
      pathBlankOnly: true,
    });
    state.refetch();
    expect(state.loading()).toBe(true);
    expect(state.error()).toBeUndefined();
    await Promise.resolve();
    expect(state.results()).toEqual(recovered);
    expect(state.error()).toBeUndefined();
    dispose();
  });

  it("keeps the newest query results when an older request resolves later", async () => {
    vi.useFakeTimers();
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const older = deferred<Awaited<ReturnType<typeof searchDocs>>>();
    const newer = deferred<Awaited<ReturnType<typeof searchDocs>>>();
    vi.mocked(searchDocs)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    let setQuery!: (value: string) => void;
    let dispose!: () => void;
    const state = createRoot((stop) => {
      dispose = stop;
      const [query, set] = createSignal("older");
      setQuery = set;
      return useServerSearch(query, filters);
    });

    expect(vi.mocked(searchDocs)).toHaveBeenCalledTimes(1);
    setQuery("newer");
    await vi.advanceTimersByTimeAsync(100);
    expect(vi.mocked(searchDocs)).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith(
      "[docs-index/search] start",
      expect.objectContaining({ q: "newer", inFlight: 1 }),
    );

    const newerResults = [
      { id: "newer", title: "Newer", createdAt: "", updatedAt: "" },
    ];
    newer.resolve(newerResults);
    await Promise.resolve();
    expect(state.results()).toEqual(newerResults);

    older.resolve([
      { id: "older", title: "Older", createdAt: "", updatedAt: "" },
    ]);
    await Promise.resolve();
    expect(state.results()).toEqual(newerResults);
    dispose();
  });

  it("exposes timeout and ignores a late response after disposal", async () => {
    vi.useFakeTimers();
    const pending = deferred<Awaited<ReturnType<typeof searchDocs>>>();
    vi.mocked(searchDocs).mockReturnValueOnce(pending.promise);
    let dispose!: () => void;
    const state = createRoot((stop) => {
      dispose = stop;
      return useServerSearch(() => "slow", filters);
    });

    expect(state.loading()).toBe(true);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(state.loading()).toBe(false);
    expect(state.error()).toBe("timeout");

    dispose();
    pending.resolve([
      { id: "late", title: "Late", createdAt: "", updatedAt: "" },
    ]);
    await Promise.resolve();
    expect(state.results()).toEqual([]);
    expect(state.error()).toBe("timeout");
  });

  it("returns successful results without an error", async () => {
    const items = [
      { id: "found", title: "Found", createdAt: "", updatedAt: "" },
    ];
    vi.mocked(searchDocs).mockResolvedValueOnce(items);
    let dispose!: () => void;
    const state = createRoot((stop) => {
      dispose = stop;
      return useServerSearch(() => "found", filters);
    });

    await Promise.resolve();
    expect(state.results()).toEqual(items);
    expect(state.error()).toBeUndefined();
    expect(state.loading()).toBe(false);
    dispose();
  });
});
