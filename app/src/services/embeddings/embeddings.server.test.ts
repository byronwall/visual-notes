import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  embedBatched: vi.fn(),
  preprocessMarkdown: vi.fn(),
  makeChunks: vi.fn(),
  prisma: {
    embeddingRun: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    docSection: { findUnique: vi.fn() },
    docSectionEmbedding: { deleteMany: vi.fn(), createMany: vi.fn() },
    docEmbedding: { deleteMany: vi.fn(), createMany: vi.fn() },
    umapRun: { findMany: vi.fn() },
  },
}));

vi.mock("~/server/db", () => ({ prisma: mocks.prisma }));
vi.mock("~/env/server", () => ({
  serverEnv: { OPENAI_API_KEY: "mock-key", EMBEDDING_MODEL: "mock-model" },
}));
vi.mock("~/server/lib/embedding/preprocess", () => ({
  preprocessMarkdown: mocks.preprocessMarkdown,
}));
vi.mock("~/server/lib/embedding/chunker", () => ({
  makeChunks: mocks.makeChunks,
}));
vi.mock("~/server/lib/embedding/hash", () => ({ sha256: () => "hash" }));
vi.mock("~/server/lib/embedding/pool", () => ({
  meanPool: (vectors: number[][]) => vectors[0],
}));
vi.mock("~/services/embeddings/embeddings.utils", () => ({
  embedBatched: mocks.embedBatched,
}));
vi.mock("~/services/umap/umap.projection", () => ({
  projectVectorsIntoUmapRun: vi.fn(),
}));

import { processEmbeddingRun } from "./embeddings.server";

type EmbeddingRow = { runId: string; docId: string; vector: number[] };

describe("processEmbeddingRun embedding writes", () => {
  let state: {
    sectionEmbeddings: EmbeddingRow[];
    docEmbeddings: EmbeddingRow[];
  };
  let events: string[];
  let markdown: string;

  beforeEach(() => {
    vi.clearAllMocks();
    state = { sectionEmbeddings: [], docEmbeddings: [] };
    events = [];
    markdown = "body";
    mocks.prisma.embeddingRun.findUnique.mockResolvedValue({
      id: "run-1",
      model: "mock-model",
      dims: 3,
      params: {},
    });
    mocks.prisma.$queryRaw.mockImplementation(
      (strings: TemplateStringsArray) => {
        return Promise.resolve(
          strings.join(" ").includes("SELECT d.")
            ? [{ id: "doc-1", title: "Doc", markdown, html: "" }]
            : [{ c: 0 }],
        );
      },
    );
    mocks.prisma.docSection.findUnique.mockResolvedValue({ id: "section-1" });
    mocks.prisma.umapRun.findMany.mockResolvedValue([]);
    mocks.preprocessMarkdown.mockReturnValue([{ text: "body" }]);
    mocks.makeChunks.mockReturnValue([
      {
        text: "body",
        headingPath: [],
        orderIndex: 0,
        charCount: 4,
        tokenCount: 1,
      },
    ]);
    mocks.prisma.docSectionEmbedding.deleteMany.mockImplementation(async () => {
      events.push("delete sections");
      state.sectionEmbeddings = [];
    });
    mocks.prisma.docEmbedding.deleteMany.mockImplementation(async () => {
      events.push("delete docs");
      state.docEmbeddings = [];
    });
    mocks.prisma.docSectionEmbedding.createMany.mockImplementation(
      async ({ data }: { data: EmbeddingRow[] }) => {
        events.push("create sections");
        state.sectionEmbeddings.push(...data);
      },
    );
    mocks.prisma.docEmbedding.createMany.mockImplementation(
      async ({ data }: { data: EmbeddingRow[] }) => {
        events.push("create docs");
        state.docEmbeddings.push(...data);
      },
    );
    mocks.prisma.$transaction.mockImplementation(async (callback) => {
      events.push("transaction start");
      const result = await callback(mocks.prisma);
      events.push("transaction commit");
      return result;
    });
  });

  it("writes no embeddings in missing mode when embedding fails", async () => {
    mocks.embedBatched.mockRejectedValue(new Error("embedding unavailable"));

    await expect(
      processEmbeddingRun({ id: "run-1", mode: "missing" }),
    ).rejects.toThrow("embedding unavailable");

    expect(state.sectionEmbeddings).toEqual([]);
    expect(state.docEmbeddings).toEqual([]);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("keeps changed vectors when embedding fails", async () => {
    state.sectionEmbeddings = [
      { runId: "run-1", docId: "doc-1", vector: [1, 2, 3] },
    ];
    state.docEmbeddings = [
      { runId: "run-1", docId: "doc-1", vector: [1, 2, 3] },
    ];
    mocks.embedBatched.mockRejectedValue(new Error("embedding unavailable"));

    await expect(
      processEmbeddingRun({ id: "run-1", mode: "changed" }),
    ).rejects.toThrow("embedding unavailable");

    expect(state.sectionEmbeddings[0]?.vector).toEqual([1, 2, 3]);
    expect(state.docEmbeddings[0]?.vector).toEqual([1, 2, 3]);
    expect(events).toEqual([]);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("replaces changed vectors in one transaction after embedding succeeds", async () => {
    state.sectionEmbeddings = [
      { runId: "run-1", docId: "doc-1", vector: [1, 2, 3] },
    ];
    state.docEmbeddings = [
      { runId: "run-1", docId: "doc-1", vector: [1, 2, 3] },
    ];
    mocks.embedBatched.mockResolvedValue([[9, 8, 7]]);

    await processEmbeddingRun({ id: "run-1", mode: "changed" });

    expect(events).toEqual([
      "transaction start",
      "delete sections",
      "delete docs",
      "create sections",
      "create docs",
      "transaction commit",
    ]);
    expect(state.sectionEmbeddings[0]?.vector).toEqual([9, 8, 7]);
    expect(state.docEmbeddings[0]?.vector).toEqual([9, 8, 7]);
  });

  it("removes old vectors when a bare URL produces no chunks", async () => {
    state.sectionEmbeddings = [
      { runId: "run-1", docId: "doc-1", vector: [1, 2, 3] },
    ];
    state.docEmbeddings = [
      { runId: "run-1", docId: "doc-1", vector: [1, 2, 3] },
    ];
    markdown = "https://example.com";
    mocks.makeChunks.mockReturnValue([]);

    await processEmbeddingRun({ id: "run-1", mode: "changed" });

    expect(mocks.embedBatched).not.toHaveBeenCalled();
    expect(events).toEqual([
      "transaction start",
      "delete sections",
      "delete docs",
      "transaction commit",
    ]);
    expect(state.sectionEmbeddings).toEqual([]);
    expect(state.docEmbeddings).toEqual([]);
  });

  it("keeps changed vectors when preprocessing fails", async () => {
    state.sectionEmbeddings = [
      { runId: "run-1", docId: "doc-1", vector: [1, 2, 3] },
    ];
    state.docEmbeddings = [
      { runId: "run-1", docId: "doc-1", vector: [1, 2, 3] },
    ];
    mocks.preprocessMarkdown.mockImplementation(() => {
      throw new Error("unsupported document content");
    });

    await processEmbeddingRun({ id: "run-1", mode: "changed" });

    expect(mocks.embedBatched).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(state.sectionEmbeddings[0]?.vector).toEqual([1, 2, 3]);
    expect(state.docEmbeddings[0]?.vector).toEqual([1, 2, 3]);
  });
});
