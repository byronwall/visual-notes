import { afterEach, describe, expect, it, vi } from "vitest";

const hookState = vi.hoisted(() => ({
  load: null as (() => Promise<unknown>) | null,
  latest: undefined as unknown,
  previewText: "Before refresh",
}));

vi.mock("@solidjs/router", () => ({
  createAsync: (load: () => Promise<unknown>) => {
    hookState.load = load;
    return () => hookState.latest;
  },
}));
vi.mock("solid-js", () => ({ createMemo: (fn: () => unknown) => fn }));
vi.mock("~/services/docs.service", () => ({
  fetchDocPreviewsBatched: vi.fn(async (ids: string[]) =>
    ids.map((id) => ({
      id,
      path: null,
      meta: null,
      previewText: hookState.previewText,
    })),
  ),
}));

import { useDocPreviewMap } from "./useDocPreviewMap";

afterEach(() => {
  hookState.load = null;
  hookState.latest = undefined;
  hookState.previewText = "Before refresh";
});

describe("useDocPreviewMap", () => {
  it("uses the refreshed result for the current visible IDs", async () => {
    let ids = Array.from({ length: 120 }, (_, i) => `doc-${i + 1}`);
    const previewMap = useDocPreviewMap(() => ids);
    const refresh = async () => {
      if (!hookState.load) throw new Error("Preview query did not load");
      hookState.latest = await hookState.load();
    };

    await refresh();
    expect(previewMap().size).toBe(120);
    expect(previewMap().get("doc-1")?.previewText).toBe("Before refresh");

    ids = Array.from({ length: 200 }, (_, i) => `doc-${i + 1}`);
    await refresh();
    expect(previewMap().size).toBe(200);
    expect(previewMap().get("doc-200")?.previewText).toBe("Before refresh");

    hookState.previewText = "After refresh";
    ids = ids.slice(0, 121);
    await refresh();

    expect(previewMap().size).toBe(121);
    expect(previewMap().get("doc-1")?.previewText).toBe("After refresh");
    expect(previewMap().has("doc-200")).toBe(false);
  });
});
