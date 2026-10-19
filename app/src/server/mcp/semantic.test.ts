import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  serverEnv: { OPENAI_API_KEY: "key" as string | undefined },
}));
const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  aggregate: vi.fn(),
  findMany: vi.fn(),
  embed: vi.fn(),
  process: vi.fn(),
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
vi.mock("~/services/embeddings/embeddings.actions", () => ({
  processEmbeddingRun: mocks.process,
}));

import {
  rankBySimilarity,
  scheduleEmbeddingRefresh,
  semanticSearch,
} from "./semantic";

beforeEach(() => {
  vi.clearAllMocks();
  env.serverEnv.OPENAI_API_KEY = "key";
  mocks.findFirst.mockResolvedValue({ id: "run1", model: "m" });
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
  it("returns null without an OpenAI key so search falls back to keywords", async () => {
    env.serverEnv.OPENAI_API_KEY = undefined;
    expect(await semanticSearch("q", 5)).toBeNull();
    expect(mocks.embed).not.toHaveBeenCalled();
  });

  it("embeds the query with the latest run's model", async () => {
    mocks.embed.mockResolvedValue([[1, 0]]);
    const hits = await semanticSearch("minimap", 5);
    expect(mocks.embed).toHaveBeenCalledWith(["minimap"], "m");
    expect(hits?.map((hit) => hit.id)).toEqual(["near", "mid"]);
  });

  it("degrades to null when the provider fails", async () => {
    mocks.embed.mockRejectedValue(new Error("429"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await semanticSearch("q", 5)).toBeNull();
  });
});

describe("scheduleEmbeddingRefresh", () => {
  it("debounces bursts of writes into one refresh of the latest run", async () => {
    vi.useFakeTimers();
    mocks.process.mockResolvedValue({ addedDocs: 1 });
    scheduleEmbeddingRefresh();
    scheduleEmbeddingRefresh();
    await vi.runAllTimersAsync();
    expect(mocks.process).toHaveBeenCalledTimes(2);
    expect(mocks.process).toHaveBeenCalledWith({
      id: "run1",
      mode: "missing",
      limit: 25,
    });
    expect(mocks.process).toHaveBeenCalledWith({
      id: "run1",
      mode: "changed",
      limit: 25,
    });
  });
});
