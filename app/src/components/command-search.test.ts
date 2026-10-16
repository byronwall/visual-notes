import type * as Solid from "solid-js";
// Use Solid's client runtime because the server build cannot create resources.
// @ts-expect-error Solid does not publish declarations for this installed runtime entry.
import * as clientRuntime from "solid-js/dist/solid.js";
import { revalidate } from "@solidjs/router";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchDocs,
  searchDocs,
  type ServerSearchItem,
} from "~/features/docs-index/data/docs.service";
import {
  commandSearchKey,
  loadCommandResults,
  retryCommandResults,
  type CommandSearchParams,
} from "./command-search";

const { createRoot, createResource, createSignal } =
  clientRuntime as typeof Solid;

vi.mock("~/features/docs-index/data/docs.service", () => ({
  fetchDocs: Object.assign(vi.fn(), {
    keyFor: vi.fn(() => "fetch-docs-key"),
  }),
  searchDocs: Object.assign(vi.fn(), {
    keyFor: vi.fn(() => "search-docs-key"),
  }),
}));
vi.mock("@solidjs/router", () => ({ revalidate: vi.fn(async () => {}) }));

const search = vi.mocked(searchDocs);
const fetch = vi.mocked(fetchDocs);
const params: CommandSearchParams = {
  q: "needle",
  sortMode: "relevance",
  activityClass: "",
};
const result: ServerSearchItem = {
  id: "doc-1",
  title: "Needle note",
  createdAt: "2026-10-16T11:00:00Z",
  updatedAt: "2026-10-16T12:00:00Z",
  path: null,
  snippet: "needle",
};

afterEach(() => {
  search.mockReset();
  fetch.mockReset();
  vi.mocked(revalidate).mockClear();
});

describe("CmdK search resource recovery", () => {
  it("shows retry for a non-array response and recovers with the same parameters", async () => {
    search
      .mockResolvedValueOnce({ status: 500 } as never)
      .mockResolvedValueOnce([result]);

    const state = createRoot((dispose) => {
      const [currentParams] = createSignal(params);
      const [resource, controls] = createResource(
        currentParams,
        loadCommandResults,
      );
      return { dispose, resource, retry: controls.refetch };
    });

    await vi.waitFor(() => expect(state.resource.loading).toBe(false));
    expect(state.resource.latest).toMatchObject({
      key: commandSearchKey(params),
      items: [],
      failed: true,
    });

    const retryOrder: string[] = [];
    vi.mocked(revalidate).mockImplementation(async () => {
      retryOrder.push("invalidate");
    });
    await retryCommandResults(params, () => {
      retryOrder.push("refetch");
      return state.retry();
    });
    expect(retryOrder).toEqual(["invalidate", "refetch"]);
    await vi.waitFor(() => expect(state.resource.loading).toBe(false));
    expect(state.resource.latest).toMatchObject({
      key: commandSearchKey(params),
      items: [{ id: "doc-1" }],
      failed: false,
    });
    expect(search).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenNthCalledWith(2, {
      q: "needle",
      take: 25,
      sortMode: "relevance",
      activityClass: undefined,
    });
    expect(search.keyFor).toHaveBeenCalledWith({
      q: "needle",
      take: 25,
      sortMode: "relevance",
      activityClass: undefined,
    });
    expect(revalidate).toHaveBeenCalledWith("search-docs-key");
    state.dispose();
  });

  it("shows retry for a rejected request and recovers", async () => {
    search
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([result]);

    const state = createRoot((dispose) => {
      const [currentParams] = createSignal(params);
      const [resource, controls] = createResource(
        currentParams,
        loadCommandResults,
      );
      return { dispose, resource, retry: controls.refetch };
    });

    await vi.waitFor(() => expect(state.resource.loading).toBe(false));
    expect(state.resource.latest?.failed).toBe(true);

    await retryCommandResults(params, state.retry);
    await vi.waitFor(() => expect(state.resource.loading).toBe(false));
    expect(state.resource.latest?.items).toEqual([result]);
    state.dispose();
  });

  it("keeps a newer query result when an older request resolves later", async () => {
    let resolveFirst!: (items: ServerSearchItem[]) => void;
    let resolveSecond!: (items: ServerSearchItem[]) => void;
    search
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockReturnValueOnce(new Promise((resolve) => (resolveSecond = resolve)));

    const state = createRoot((dispose) => {
      const [currentParams, setParams] = createSignal(params);
      const [resource] = createResource(currentParams, loadCommandResults);
      return { dispose, resource, setParams };
    });

    await vi.waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    const nextParams = { ...params, q: "newer" };
    state.setParams(nextParams);
    await vi.waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    resolveSecond([{ ...result, id: "newer-result" }]);
    await vi.waitFor(() =>
      expect(state.resource.latest?.items[0]?.id).toBe("newer-result"),
    );
    resolveFirst([{ ...result, id: "older-result" }]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.resource.latest).toMatchObject({
      key: commandSearchKey(nextParams),
      items: [{ id: "newer-result" }],
      failed: false,
    });
    state.dispose();
  });

  it("applies the same failure state to the empty-query feed", async () => {
    const feedParams = { ...params, q: "" };
    fetch
      .mockResolvedValueOnce({ status: 500 } as never)
      .mockResolvedValueOnce([result]);
    const state = createRoot((dispose) => {
      const [currentParams] = createSignal(feedParams);
      const [resource, controls] = createResource(
        currentParams,
        loadCommandResults,
      );
      return { dispose, resource, retry: controls.refetch };
    });

    await vi.waitFor(() => expect(state.resource.loading).toBe(false));
    expect(state.resource.latest?.failed).toBe(true);
    await retryCommandResults(feedParams, state.retry);
    await vi.waitFor(() => expect(state.resource.loading).toBe(false));
    expect(state.resource.latest).toMatchObject({
      key: commandSearchKey(feedParams),
      items: [{ id: "doc-1", snippet: undefined }],
      failed: false,
    });
    expect(fetch.keyFor).toHaveBeenCalledWith({
      take: 25,
      sortMode: "recent_activity",
      activityClass: undefined,
    });
    expect(revalidate).toHaveBeenCalledWith("fetch-docs-key");
    state.dispose();
  });
});
