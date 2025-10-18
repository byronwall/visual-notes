import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";
import { z } from "zod";
import { serverEnv } from "~/env/server";

const bodySchema = z.object({
  model: z.string().optional(),
  dims: z.number().int().positive().optional(),
  params: z.record(z.any()).optional(),
});

// Keep each input well under the model's context limit. Roughly ~4 chars/token,
// so 8000 chars ≈ 2000 tokens. We'll implement smarter chunking later.
const MAX_EMBED_INPUT_CHARS = 8000;

function truncateForEmbedding(text: string): string {
  return text.length > MAX_EMBED_INPUT_CHARS
    ? text.slice(0, MAX_EMBED_INPUT_CHARS)
    : text;
}

async function embedWithOpenAI(
  texts: string[],
  model: string
): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(
      `OpenAI embeddings error ${res.status}: ${msg.slice(0, 400)}`
    );
  }
  const json = (await res.json()) as any;
  const data = Array.isArray(json.data) ? json.data : [];
  return data.map((d: any) => d.embedding as number[]);
}

export async function POST(event: APIEvent) {
  if (!serverEnv.OPENAI_API_KEY) {
    return json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }
  try {
    const { model, dims, params } = bodySchema.parse(
      await event.request.json().catch(() => ({}))
    );
    const useModel =
      model || serverEnv.EMBEDDING_MODEL || "text-embedding-3-small";

    // Fetch all docs (simple initial implementation). Real systems should page/batch.
    const docs = await (prisma as any).doc.findMany({
      select: { id: true, title: true, markdown: true },
      orderBy: { createdAt: "asc" },
    });
    const inputs = docs.map((d: any) =>
      truncateForEmbedding(`${d.title}\n\n${d.markdown}`)
    );
    const vectors = inputs.length
      ? await embedWithOpenAI(inputs, useModel)
      : [];
    const inferredDims = vectors[0]?.length ?? (dims || 1536);

    // Create an embedding run
    const run = await (prisma as any).embeddingRun.create({
      data: { model: useModel, dims: inferredDims, params: params ?? {} },
      select: { id: true },
    });

    // Insert embeddings in batches
    const now = new Date();
    const rows = docs.map((d: any, i: number) => ({
      runId: run.id,
      docId: d.id,
      vector: vectors[i] || [],
      createdAt: now,
    }));
    if (rows.length) {
      // prisma createMany for speed; fall back if not available on this client
      await (prisma as any).docEmbedding.createMany({
        data: rows,
        skipDuplicates: true,
      });
    }

    return json({ runId: run.id, count: rows.length }, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message || "Failed to create embedding run";
    return json({ error: msg }, { status: 400 });
  }
}

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("limit") || "20"))
  );
  // List recent embedding runs
  const runs = await (prisma as any).embeddingRun.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      model: true,
      dims: true,
      params: true,
      createdAt: true,
    },
    take: limit,
  });
  // Attach counts of embedded docs per run
  const runIds = runs.map((r: any) => r.id);
  let idToCount: Record<string, number> = {};
  if (runIds.length) {
    // Prefer a single groupBy query for efficiency; fall back to 0 if unsupported
    const grouped = await (prisma as any).docEmbedding
      .groupBy({
        by: ["runId"],
        _count: { _all: true },
        where: { runId: { in: runIds } },
      })
      .catch(() => [] as any[]);
    idToCount = Object.fromEntries(
      (grouped as any[]).map((g: any) => [g.runId, g._count?._all ?? 0])
    );
  }
  const runsWithCounts = runs.map((r: any) => ({
    ...r,
    count: idToCount[r.id] ?? 0,
  }));
  return json({ runs: runsWithCounts });
}
