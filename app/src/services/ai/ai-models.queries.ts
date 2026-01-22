import { query } from "@solidjs/router";
import { SUPPORTED_MODELS, type SupportedModel } from "~/server/lib/models";

export type AiModelsResponse = { items: SupportedModel[] };

export const fetchAiModels = query(async (): Promise<AiModelsResponse> => {
  "use server";
  console.log(`[services] fetchAiModels count=${SUPPORTED_MODELS.length}`);
  return { items: SUPPORTED_MODELS };
}, "ai-models");
