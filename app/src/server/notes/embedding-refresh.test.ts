import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  serverEnv: { OPENAI_API_KEY: "key" as string | undefined },
}));
const mocks = vi.hoisted(() => ({
  embeddingRunFindFirst: vi.fn(),
  embeddingRunCount: vi.fn(),
  umapRunFindFirst: vi.fn(),
  umapRunCount: vi.fn(),
  umapPointCount: vi.fn(),
  docEmbeddingCount: vi.fn(),
  process: vi.fn(),
  createEmbeddingRun: vi.fn(),
  createUmapRun: vi.fn(),
  project: vi.fn(),
}));
vi.mock("~/env/server", () => env);
vi.mock("~/server/db", () => ({
  prisma: {
    embeddingRun: {
      findFirst: mocks.embeddingRunFindFirst,
      count: mocks.embeddingRunCount,
    },
    umapRun: { findFirst: mocks.umapRunFindFirst, count: mocks.umapRunCount },
    umapPoint: { count: mocks.umapPointCount },
    docEmbedding: { count: mocks.docEmbeddingCount },
  },
}));
vi.mock("~/services/embeddings/embeddings.actions", () => ({
  processEmbeddingRun: mocks.process,
  createEmbeddingRun: mocks.createEmbeddingRun,
}));
vi.mock("~/services/umap/umap.actions", () => ({
  createUmapRun: mocks.createUmapRun,
}));
vi.mock("~/services/umap/umap.projection", () => ({
  projectDocEmbeddingsIntoUmapRun: mocks.project,
}));

import { scheduleEmbeddingRefresh } from "./embedding-refresh";
import { contentColumns, setContentWriteHook } from "./note-store";
import { fromMarkdown } from "~/lib/note-content/convert";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  env.serverEnv.OPENAI_API_KEY = "key";
  mocks.embeddingRunFindFirst.mockResolvedValue({ id: "run1" });
  mocks.umapRunFindFirst.mockResolvedValue({
    id: "map1",
    embeddingRunId: "run1",
  });
  mocks.embeddingRunCount.mockResolvedValue(1);
  mocks.umapRunCount.mockResolvedValue(1);
  mocks.umapPointCount.mockResolvedValue(10);
  mocks.docEmbeddingCount.mockResolvedValue(10);
  mocks.process.mockResolvedValue({ addedDocs: 1, remaining: 0 });
});
afterEach(() => vi.useRealTimers());

describe("scheduleEmbeddingRefresh", () => {
  it("debounces bursts of writes into one refresh of the latest run", async () => {
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

  it("is queued by every content write", async () => {
    setContentWriteHook(() => scheduleEmbeddingRefresh());
    contentColumns(fromMarkdown("A new note"));
    expect(mocks.process).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(mocks.process).toHaveBeenCalledTimes(2);
  });

  it("also refreshes the run behind the canvas map when it is older", async () => {
    mocks.umapRunFindFirst.mockResolvedValue({
      id: "map0",
      embeddingRunId: "run0",
    });
    scheduleEmbeddingRefresh();
    await vi.runAllTimersAsync();
    const runs = new Set(mocks.process.mock.calls.map(([arg]) => arg.id));
    expect(runs).toEqual(new Set(["run1", "run0"]));
  });

  it("drains large backlogs in follow-up batches", async () => {
    mocks.process
      .mockResolvedValueOnce({ addedDocs: 25, remaining: 30 })
      .mockResolvedValueOnce({ addedDocs: 25, remaining: 5 })
      .mockResolvedValueOnce({ addedDocs: 5, remaining: 0 });
    scheduleEmbeddingRefresh();
    await vi.runAllTimersAsync();
    // three "missing" batches, then one "changed" pass
    expect(mocks.process).toHaveBeenCalledTimes(4);
  });

  it("does nothing when embeddings are not configured", async () => {
    env.serverEnv.OPENAI_API_KEY = undefined;
    scheduleEmbeddingRefresh({ sweep: true });
    await vi.runAllTimersAsync();
    expect(mocks.embeddingRunFindFirst).not.toHaveBeenCalled();
    expect(mocks.embeddingRunCount).not.toHaveBeenCalled();
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it("never throws when the refresh fails", async () => {
    mocks.process.mockRejectedValue(new Error("openai down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => scheduleEmbeddingRefresh()).not.toThrow();
    await vi.runAllTimersAsync();
    expect(warn).toHaveBeenCalled();
  });
});

describe("sweep", () => {
  it("projects embedded notes the map has no point for", async () => {
    mocks.umapPointCount.mockResolvedValue(8);
    scheduleEmbeddingRefresh({ sweep: true });
    await vi.runAllTimersAsync();
    expect(mocks.project).toHaveBeenCalledWith({
      umapRunId: "map1",
      mode: "missing",
    });
  });

  it("skips projection when every embedding already has a point", async () => {
    scheduleEmbeddingRefresh({ sweep: true });
    await vi.runAllTimersAsync();
    expect(mocks.project).not.toHaveBeenCalled();
  });

  it("bootstraps the first embedding run and map", async () => {
    mocks.embeddingRunCount.mockResolvedValue(0);
    mocks.umapRunCount.mockResolvedValue(0);
    mocks.embeddingRunFindFirst.mockResolvedValue({
      id: "fresh",
      _count: { docEmbeddings: 12 },
    });
    scheduleEmbeddingRefresh({ sweep: true });
    await vi.runAllTimersAsync();
    expect(mocks.createEmbeddingRun).toHaveBeenCalledWith({});
    expect(mocks.createUmapRun).toHaveBeenCalledWith({
      embeddingRunId: "fresh",
      dims: 2,
    });
  });

  it("never trains a new map when one exists", async () => {
    mocks.embeddingRunCount.mockResolvedValue(3);
    mocks.umapRunCount.mockResolvedValue(1);
    scheduleEmbeddingRefresh({ sweep: true });
    await vi.runAllTimersAsync();
    expect(mocks.createEmbeddingRun).not.toHaveBeenCalled();
    expect(mocks.createUmapRun).not.toHaveBeenCalled();
  });

  it("does not bootstrap on a plain write refresh", async () => {
    mocks.embeddingRunCount.mockResolvedValue(0);
    mocks.umapRunCount.mockResolvedValue(0);
    scheduleEmbeddingRefresh();
    await vi.runAllTimersAsync();
    expect(mocks.embeddingRunCount).not.toHaveBeenCalled();
    expect(mocks.createEmbeddingRun).not.toHaveBeenCalled();
  });
});
