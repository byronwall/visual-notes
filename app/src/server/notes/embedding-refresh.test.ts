import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  serverEnv: { OPENAI_API_KEY: "key" as string | undefined },
}));
const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  process: vi.fn(),
}));
vi.mock("~/env/server", () => env);
vi.mock("~/server/db", () => ({
  prisma: { embeddingRun: { findFirst: mocks.findFirst } },
}));
vi.mock("~/services/embeddings/embeddings.actions", () => ({
  processEmbeddingRun: mocks.process,
}));

import { scheduleEmbeddingRefresh } from "./embedding-refresh";
import { contentColumns } from "./note-store";
import { fromMarkdown } from "~/lib/note-content/convert";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  env.serverEnv.OPENAI_API_KEY = "key";
  mocks.findFirst.mockResolvedValue({ id: "run1" });
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
    contentColumns(fromMarkdown("A new note"));
    expect(mocks.process).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(mocks.process).toHaveBeenCalledTimes(2);
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
    scheduleEmbeddingRefresh();
    await vi.runAllTimersAsync();
    expect(mocks.findFirst).not.toHaveBeenCalled();
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
