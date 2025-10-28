import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";
import { z } from "zod";
import { serverEnv } from "~/env/server";
import {
  preprocessMarkdown,
  type PreprocessFlags,
} from "~/server/lib/embedding/preprocess";
import { makeChunks, type ChunkerConfig } from "~/server/lib/embedding/chunker";
import { sha256 } from "~/server/lib/embedding/hash";
import { meanPool } from "~/server/lib/embedding/pool";

const bodySchema = z.object({
  model: z.string().optional(),
  dims: z.number().int().positive().optional(),
  params: z.record(z.any()).optional(), // feature flags and chunker settings
});

// Batch sizes for embedding API
const BATCH_SIZE = 128;

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

function estimateTokensApprox(s: string): number {
  // Use a conservative estimate (~3 chars/token) to avoid undercounting
  return Math.max(1, Math.round(s.length / 3));
}

async function embedBatched(
  texts: string[],
  model: string
): Promise<number[][]> {
  // OpenAI embeddings have a max context per request (~8192 tokens).
  // Keep a conservative cap for both items and the total batch.
  const MAX_BATCH_TOKENS = 7500;
  const PER_ITEM_TOKEN_LIMIT = 7400;

  function truncateToTokenLimit(s: string, maxTokens: number): string {
    const maxChars = Math.max(32, maxTokens * 3);
    if (estimateTokensApprox(s) <= maxTokens) return s;
    const out = s.slice(0, maxChars).trim();
    return out;
  }

  // Prepare output aligned to input order
  const result: number[][] = new Array(texts.length).fill(null as any);

  // Build batches (preserving order) and send
  let cursor = 0;
  while (cursor < texts.length) {
    let tokenSum = 0;
    const batchTexts: string[] = [];
    const batchIdxs: number[] = [];

    // Fill batch respecting token cap and skipping empty inputs
    while (cursor < texts.length && batchTexts.length < BATCH_SIZE) {
      const raw = String(texts[cursor] || "").trim();
      if (!raw) {
        result[cursor] = [];
        cursor++;
        continue;
      }
      const truncated = truncateToTokenLimit(raw, PER_ITEM_TOKEN_LIMIT);
      const tok = estimateTokensApprox(truncated);
      if (tok > MAX_BATCH_TOKENS && batchTexts.length === 0) {
        // Send this single item alone
        batchTexts.push(truncated);
        batchIdxs.push(cursor);
        cursor++;
        break;
      }
      if (tokenSum + tok > MAX_BATCH_TOKENS) break;
      batchTexts.push(truncated);
      batchIdxs.push(cursor);
      tokenSum += tok;
      cursor++;
    }

    if (batchTexts.length === 0) {
      // Nothing to send in this loop; advance to avoid infinite loop
      cursor++;
      continue;
    }

    try {
      const vecs = await embedWithOpenAI(batchTexts, model);
      console.log(
        `[embeddings] batch size`,
        batchTexts.length,
        `approxTokens`,
        tokenSum
      );
      for (let k = 0; k < batchIdxs.length; k++) {
        result[batchIdxs[k]] = vecs[k] || [];
      }
    } catch (err) {
      console.log(
        `[embeddings] batch failed, falling back to single requests`,
        err
      );
      // Fallback: try each item individually; skip on error
      for (let k = 0; k < batchIdxs.length; k++) {
        const idx = batchIdxs[k];
        const t = batchTexts[k];
        try {
          const v = await embedWithOpenAI([t], model);
          result[idx] = v[0] || [];
        } catch (e) {
          console.log(`[embeddings] item failed, skipping index`, idx, e);
          result[idx] = [];
        }
      }
    }
  }

  // Ensure all positions are set
  for (let i = 0; i < result.length; i++) {
    if (!Array.isArray(result[i])) result[i] = [];
  }
  return result;
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
    const docs = await prisma.doc.findMany({
      select: { id: true, title: true, markdown: true },
      orderBy: { createdAt: "asc" },
    });

    // Prepare sections/chunks per doc
    type ChunkItem = {
      docId: string;
      text: string;
      headingPath: string[];
      orderIndex: number;
      charCount: number;
      tokenCount?: number;
      contentHash: string;
      sectionId?: string;
    };

    const allChunks: ChunkItem[] = [];
    const flags: PreprocessFlags | undefined = params as any;
    const chunkCfg: ChunkerConfig | undefined = params as any;

    for (const d of docs as any[]) {
      try {
        const sections = preprocessMarkdown(String(d.markdown || ""), flags);
        const chunks = makeChunks(sections, chunkCfg);
        for (const c of chunks) {
          const contentHash = sha256(c.text);
          const headingPath = Array.isArray(c.headingPath)
            ? c.headingPath.filter(
                (h: unknown): h is string =>
                  typeof h === "string" && h.length > 0
              )
            : [];
          allChunks.push({
            docId: String(d.id),
            text: c.text,
            headingPath,
            orderIndex: c.orderIndex,
            charCount: c.charCount,
            tokenCount: c.tokenCount,
            contentHash,
          });
        }
      } catch (err) {
        console.log(
          `[embeddings] Skipping doc during chunking ${String(d.id)}:`,
          err
        );
        continue;
      }
    }

    // Create run with dims placeholder; we'll infer from first embeddings
    const run = await prisma.embeddingRun.create({
      data: { model: useModel, dims: dims || 1536, params: params ?? {} },
      select: { id: true },
    });

    // Upsert DocSection rows to obtain IDs
    const validChunks: ChunkItem[] = [];
    for (const item of allChunks) {
      try {
        const existing = await prisma.docSection
          .findUnique({
            where: {
              docId_contentHash: {
                docId: item.docId,
                contentHash: item.contentHash,
              },
            },
            select: { id: true },
          })
          .catch(() => null as any);
        if (existing?.id) {
          item.sectionId = existing.id;
          validChunks.push(item);
          continue;
        }
        const created = await prisma.docSection.create({
          data: {
            docId: item.docId,
            headingPath: item.headingPath,
            text: item.text,
            contentHash: item.contentHash,
            orderIndex: item.orderIndex,
            charCount: item.charCount,
            tokenCount: item.tokenCount ?? null,
          },
          select: { id: true },
        });
        item.sectionId = created.id;
        validChunks.push(item);
      } catch (err) {
        console.log(
          `[embeddings] Skipping section ${item.docId} ${item.contentHash}:`,
          err
        );
        continue;
      }
    }

    // Embed all chunk texts in batches
    console.log(
      `[embeddings] Creating section embeddings for`,
      validChunks.length,
      `chunks`
    );
    const vectors = validChunks.length
      ? await embedBatched(
          validChunks.map((c) => c.text),
          useModel
        )
      : [];
    const inferredDims = vectors[0]?.length ?? (dims || 1536);
    // Persist inferred dims if different
    if (!dims && inferredDims) {
      await prisma.embeddingRun.update({
        where: { id: run.id },
        data: { dims: inferredDims },
      });
    }

    // Prepare DocSectionEmbedding rows
    const now = new Date();
    const sectionEmbRows = validChunks.map((c, i) => ({
      runId: run.id,
      docId: c.docId,
      sectionId: c.sectionId!,
      vector: vectors[i] || [],
      tokenCount: c.tokenCount ?? null,
      createdAt: now,
    }));
    if (sectionEmbRows.length) {
      await prisma.docSectionEmbedding.createMany({
        data: sectionEmbRows,
        skipDuplicates: true,
      });
    }

    // Build pooled doc embeddings
    const docIdToVectors = new Map<string, number[][]>();
    for (let i = 0; i < validChunks.length; i++) {
      const c = validChunks[i];
      const v = vectors[i] || [];
      if (!docIdToVectors.has(c.docId)) docIdToVectors.set(c.docId, []);
      docIdToVectors.get(c.docId)!.push(v);
    }

    const docRows: {
      runId: string;
      docId: string;
      vector: number[];
      contentHash: string;
      sectionCount: number;
      tokenCount: number | null;
      createdAt: Date;
    }[] = [];
    for (const d of docs as any[]) {
      const docId = String(d.id);
      const vecs = docIdToVectors.get(docId) || [];
      if (!vecs.length) continue;
      const pooled = meanPool(vecs);
      const textForHash = validChunks
        .filter((c) => c.docId === docId)
        .map((c) => c.text)
        .join("\n\n");
      const contentHash = sha256(textForHash);
      const sectionCount = vecs.length;
      const tokenCount = validChunks
        .filter((c) => c.docId === docId)
        .reduce((sum, c) => sum + (c.tokenCount || 0), 0);
      docRows.push({
        runId: run.id,
        docId,
        vector: pooled,
        contentHash,
        sectionCount,
        tokenCount,
        createdAt: now,
      });
    }
    if (docRows.length) {
      await prisma.docEmbedding.createMany({
        data: docRows,
        skipDuplicates: true,
      });
    }

    return json(
      {
        runId: run.id,
        docCount: docRows.length,
        sectionCount: sectionEmbRows.length,
      },
      { status: 201 }
    );
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
  const runs = await prisma.embeddingRun.findMany({
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
    const grouped = await prisma.docEmbedding
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
