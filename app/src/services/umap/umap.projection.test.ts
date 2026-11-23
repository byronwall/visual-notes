import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  run: {
    id: "map",
    embeddingRunId: "run",
    dims: 2,
    artifactPath: "a.joblib",
    alignment: null,
  },
  embeddingFindMany: vi.fn(),
  transform: vi.fn(),
  retrain: vi.fn(),
}));
vi.mock("~/server/db", () => ({
  prisma: {
    umapRun: { findUnique: async () => mocks.run },
    docEmbedding: { findMany: mocks.embeddingFindMany },
    umapPoint: {
      findMany: async () => [],
      deleteMany: async () => ({}),
      createMany: async () => ({}),
    },
    $transaction: async (writes: Promise<unknown>[]) => Promise.all(writes),
  },
}));
vi.mock("~/server/lib/umap/python-umap", () => ({
  transformWithUmapModel: mocks.transform,
  isUmapModelLoadError: (error: Error) =>
    error.message.includes("UMAP_MODEL_LOAD_FAILED"),
}));
vi.mock("~/services/umap/umap.retrain", () => ({
  maybeRetrainUmapRun: mocks.retrain,
}));
vi.mock("~/services/umap/umap.regions", () => ({
  regenerateUmapRegions: async () => ({}),
}));

import { projectDocEmbeddingsIntoUmapRun } from "./umap.projection";

const project = () =>
  projectDocEmbeddingsIntoUmapRun({ umapRunId: "map", mode: "missing" });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.embeddingFindMany.mockResolvedValue([
    { docId: "note", vector: [1, 2] },
  ]);
});

it("pauses after a failed transform until the model changes", async () => {
  mocks.transform.mockRejectedValue(
    new Error(
      "[umap-python] UMAP_MODEL_LOAD_FAILED AttributeError: 'NNDescent' object has no attribute",
    ),
  );
  await expect(project()).rejects.toThrow("NNDescent");
  // A model that cannot load retrains the map instead of waiting.
  await vi.waitFor(() =>
    expect(mocks.retrain).toHaveBeenCalledWith("map", { force: true }),
  );

  // The retry fails fast, before loading any vectors.
  await expect(project()).rejects.toThrow("paused run=map");
  expect(mocks.embeddingFindMany).toHaveBeenCalledTimes(1);
  expect(mocks.transform).toHaveBeenCalledTimes(1);

  // A retrained model has a new artifact, which lifts the pause.
  mocks.run.artifactPath = "b.joblib";
  mocks.transform.mockResolvedValue({ points: [[0, 1]] });
  await expect(project()).resolves.toMatchObject({ projected: 1 });
});
