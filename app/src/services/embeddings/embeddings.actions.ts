import { action } from "@solidjs/router";
import * as embeddings from "./embeddings.server";

export const createEmbeddingRun = action(
  async (payload: Parameters<typeof embeddings.createEmbeddingRun>[0]) => {
    "use server";
    return embeddings.createEmbeddingRun(payload);
  },
  "embedding-run-create",
);

export const updateEmbeddingRun = action(
  async (payload: Parameters<typeof embeddings.updateEmbeddingRun>[0]) => {
    "use server";
    return embeddings.updateEmbeddingRun(payload);
  },
  "embedding-run-update",
);

export const deleteEmbeddingRun = action(
  async (payload: Parameters<typeof embeddings.deleteEmbeddingRun>[0]) => {
    "use server";
    return embeddings.deleteEmbeddingRun(payload);
  },
  "embedding-run-delete",
);

export const processEmbeddingRun = action(
  async (payload: Parameters<typeof embeddings.processEmbeddingRun>[0]) => {
    "use server";
    return embeddings.processEmbeddingRun(payload);
  },
  "embedding-run-process",
);
