import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { SUPPORTED_MODELS } from "~/server/lib/models";

export async function GET(_event: APIEvent) {
  console.log(`[api/ai/models] GET count=${SUPPORTED_MODELS.length}`);
  return json({ items: SUPPORTED_MODELS });
}


