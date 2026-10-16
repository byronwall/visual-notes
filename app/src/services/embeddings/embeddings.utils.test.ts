import { afterEach, describe, expect, it, vi } from "vitest";
import { embedBatched } from "./embeddings.utils";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("embedBatched", () => {
  it("rejects when a failed batch and its singleton retry fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    await expect(embedBatched(["section text"], "mock-model")).rejects.toThrow(
      "Embedding failed for one or more inputs",
    );
  });

  it("recovers from a partial batch response when every singleton succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ embedding: [1, 2, 3] }] })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ embedding: [1, 2, 3] }] })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ embedding: [4, 5, 6] }] })),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      embedBatched(["first", "second"], "mock-model"),
    ).resolves.toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects partial singleton responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ embedding: [1, 2, 3] }] })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ embedding: [1, 2, 3] }] })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      embedBatched(["first", "second"], "mock-model"),
    ).rejects.toThrow("Embedding failed for one or more inputs");
  });

  it("rejects nonfinite values and inconsistent vector dimensions", async () => {
    const nonfiniteResponse = () =>
      new Response(
        JSON.stringify({ data: [{ embedding: [1, Number.NaN, 3] }] }),
      );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(nonfiniteResponse())
        .mockResolvedValueOnce(nonfiniteResponse()),
    );
    await expect(embedBatched(["section"], "mock-model")).rejects.toThrow();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ embedding: [1, 2, 3] }, { embedding: [4, 5] }],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ embedding: [1, 2, 3] }] })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ embedding: [4, 5] }] })),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      embedBatched(["first", "second"], "mock-model"),
    ).rejects.toThrow("Embedding response contained an invalid vector");
  });
});
