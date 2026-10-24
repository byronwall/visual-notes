import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  serverEnv: { OPENAI_API_KEY: "key" as string | undefined },
}));
const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  aggregate: vi.fn(),
  findMany: vi.fn(),
  embed: vi.fn(),
}));
vi.mock("~/env/server", () => env);
vi.mock("~/server/db", () => ({
  prisma: {
    embeddingRun: { findFirst: mocks.findFirst },
    docEmbedding: { aggregate: mocks.aggregate, findMany: mocks.findMany },
  },
}));
vi.mock("~/services/embeddings/embeddings.utils", () => ({
  embedWithOpenAI: mocks.embed,
}));

import {
  rankBySimilarity,
  semanticSearch,
} from "./semantic";

let runNumber = 0;
beforeEach(() => {
  vi.clearAllMocks();
  env.serverEnv.OPENAI_API_KEY = "key";
  mocks.findFirst.mockResolvedValue({ id: `run${++runNumber}`, model: "m" });
  mocks.aggregate.mockResolvedValue({
    _count: { _all: 3 },
    _max: { createdAt: new Date(1) },
  });
  mocks.findMany.mockResolvedValue([
    { docId: "near", vector: [1, 0.1] },
    { docId: "far", vector: [-1, 0] },
    { docId: "mid", vector: [0.7, 0.7] },
  ]);
});

afterEach(() => vi.useRealTimers());

describe("rankBySimilarity", () => {
  it("orders by cosine similarity and drops unrelated docs", () => {
    const vectors = [
      Float32Array.from([1, 0]),
      Float32Array.from([0, 1]),
      Float32Array.from([0.9, 0.3]),
    ];
    const hits = rankBySimilarity(
      [1, 0],
      { docIds: ["a", "b", "c"], vectors, norms: [1, 1, Math.hypot(0.9, 0.3)] },
      5,
    );
    expect(hits.map((hit) => hit.id)).toEqual(["a", "c"]);
  });
});

describe("semanticSearch", () => {
  it("is off without an OpenAI key so search falls back to keywords", async () => {
    env.serverEnv.OPENAI_API_KEY = undefined;
    expect(await semanticSearch("q", 5)).toEqual({ status: "off", hits: [] });
    expect(mocks.embed).not.toHaveBeenCalled();
  });

  it("embeds the query with the latest run's model", async () => {
    mocks.embed.mockResolvedValue([[1, 0]]);
    const { status, hits } = await semanticSearch("minimap", 5);
    expect(mocks.embed).toHaveBeenCalledWith(["minimap"], "m");
    expect(status).toBe("used");
    expect(hits.map((hit) => hit.id)).toEqual(["near", "mid"]);
  });

  it("reports a failure when the provider fails", async () => {
    mocks.embed.mockRejectedValue(new Error("429"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await semanticSearch("q", 5)).toEqual({ status: "failed", hits: [] });
  });

  it("shares a cold index load across concurrent searches", async () => {
    mocks.embed.mockResolvedValue([[1, 0]]);
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    mocks.findMany.mockImplementationOnce(async () => {
      await ready;
      return [{ id: "a", docId: "near", vector: [1, 0] }];
    });
    const searches = [semanticSearch("one", 5), semanticSearch("two", 5)];
    await vi.waitFor(() => expect(mocks.findMany).toHaveBeenCalledTimes(1));
    release();
    const results = await Promise.all(searches);
    expect(results[0]).toEqual(results[1]);
    expect(results[0].hits[0].id).toBe("near");
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    await semanticSearch("cached", 5);
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
  });

  it("reads vectors in bounded pages without losing matches", async () => {
    mocks.embed.mockResolvedValue([[1, 0]]);
    const rows = Array.from({ length: 503 }, (_, i) => ({
      id: String(i).padStart(4, "0"),
      docId: `doc${i}`,
      vector: [1, 0],
    }));
    mocks.findMany.mockImplementation(async ({ where, take }) => {
      expect(take).toBeLessThanOrEqual(250);
      const start = where.id
        ? rows.findIndex((r) => r.id === where.id.gt) + 1
        : 0;
      return rows.slice(start, start + take);
    });
    const { hits } = await semanticSearch("all", 600);
    expect(hits.map((hit) => hit.id)).toEqual(rows.map((row) => row.docId));
    expect(mocks.findMany).toHaveBeenCalledTimes(3);
  });

  it("decodes only new rows after a refresh re-embeds a note", async () => {
    mocks.embed.mockResolvedValue([[1, 0]]);
    mocks.findMany.mockResolvedValueOnce([
      { id: "r1", docId: "near", vector: [1, 0.1] },
      { id: "r2", docId: "mid", vector: [0.7, 0.7] },
    ]);
    await semanticSearch("first", 5);
    // The refresh deleted r2 and wrote r3 for the same note.
    mocks.aggregate.mockResolvedValue({
      _count: { _all: 2 },
      _max: { createdAt: new Date(2) },
    });
    mocks.findMany
      .mockResolvedValueOnce([{ id: "r1" }, { id: "r3" }])
      .mockResolvedValueOnce([{ id: "r3", docId: "mid", vector: [1, 0] }]);
    const { hits } = await semanticSearch("after", 5);
    expect(mocks.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { id: { in: ["r3"] } } }),
    );
    expect(hits.map((hit) => hit.id).sort()).toEqual(["mid", "near"]);
    expect(hits.find((hit) => hit.id === "mid")?.score).toBeCloseTo(1);
  });

  it("answers within the budget while a cold load keeps going", async () => {
    mocks.embed.mockResolvedValue([[1, 0]]);
    let release!: () => void;
    mocks.findMany.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve([{ id: "a", docId: "near", vector: [1, 0] }]);
        }),
    );
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await semanticSearch("slow", 5, 20)).toEqual({ status: "loading", hits: [] });
    release();
    await vi.waitFor(async () =>
      expect((await semanticSearch("later", 5, 20)).status).toBe("used"),
    );
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
  });

  it("retries after a failed index load", async () => {
    mocks.embed.mockResolvedValue([[1, 0]]);
    mocks.findMany.mockRejectedValueOnce(new Error("database unavailable"));
    expect((await semanticSearch("first", 5)).status).toBe("failed");
    expect((await semanticSearch("retry", 5)).hits.map((hit) => hit.id)).toEqual([
      "near",
      "mid",
    ]);
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
  });
});
