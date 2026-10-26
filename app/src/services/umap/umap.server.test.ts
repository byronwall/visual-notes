import { expect, it, vi } from "vitest";

vi.mock("~/server/db", () => ({
  prisma: {
    docEmbedding: { findMany: async () => [{ docId: "note", vector: [1, 2] }] },
    umapRun: {
      create: async () => ({ id: "map" }),
      update: async () => ({}),
    },
    umapPoint: { createMany: async () => ({ count: 1 }) },
    $transaction: async (writes: Promise<unknown>[]) => Promise.all(writes),
  },
}));
vi.mock("~/server/jobs-db", () => ({
  jobsDb: () => ({
    createJob: async () => ({ id: "job" }),
    updateJobStage: async () => {},
    completeJob: async () => {},
  }),
}));
vi.mock("~/server/lib/umap/python-umap", () => ({
  trainUmapModel: async () => ({ artifactPath: "/tmp/map", points: [[0, 1]] }),
  removeUmapArtifact: async () => {},
}));
vi.mock("~/services/umap/umap.regions", () => ({
  regenerateUmapRegions: async () => ({}),
}));

import { createUmapRun } from "./umap.server";

it("creates the first map without an HTTP request or router context", async () => {
  await expect(createUmapRun({ embeddingRunId: "run", dims: 2 })).resolves.toEqual({
    jobId: "job",
    runId: "map",
    count: 1,
  });
});
