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

const idParam = z.object({ id: z.string().min(1) });
const patchSchema = z.object({
  model: z.string().optional(),
  dims: z.number().int().positive().optional(),
  params: z.record(z.any()).optional(),
});

export async function GET(event: APIEvent) {
  const id =
    event.params?.id || new URL(event.request.url).pathname.split("/").pop();
  const parsed = idParam.safeParse({ id });
  if (!parsed.success) return json({ error: "Invalid id" }, { status: 400 });
  const url = new URL(event.request.url);
  const includeParam = (url.searchParams.get("include") || "").split(",");
  const includeDocs = includeParam.includes("docs");
  const limit = Math.min(
    500,
    Math.max(1, Number(url.searchParams.get("limit") || "50"))
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") || "0"));

  const run = await prisma.embeddingRun.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      model: true,
      dims: true,
      params: true,
      createdAt: true,
    },
  });
  if (!run) return json({ error: "Not found" }, { status: 404 });
  const count = await prisma.docEmbedding.count({
    where: { runId: run.id },
  });
  const sectionCount = await prisma.docSectionEmbedding
    .count({ where: { runId: run.id } })
    .catch(() => 0);
  const totalDocs = await prisma.doc.count();
  const remaining = Math.max(0, totalDocs - count);
  if (!includeDocs) return json({ ...run, count, sectionCount, remaining });

  // When requested, return a paginated list of note summaries included in this run
  const rows = await prisma.docEmbedding.findMany({
    where: { runId: run.id },
    select: { docId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: limit,
    skip: offset,
  });
  const docIds = rows.map((r: any) => r.docId);
  const docs = docIds.length
    ? await prisma.doc.findMany({
        where: { id: { in: docIds } },
        select: { id: true, title: true },
      })
    : [];
  const byId = new Map<string, { id: string; title: string }>(
    (docs as any[]).map((d: any) => [
      String(d.id),
      { id: String(d.id), title: String(d.title) },
    ])
  );
  const items = rows.map((r: any) => ({
    id: r.docId,
    title: byId.get(r.docId)?.title || "(untitled)",
    embeddedAt: r.createdAt,
  }));
  return json({
    ...run,
    count,
    sectionCount,
    remaining,
    docs: { items, limit, offset },
  });
}

export async function PATCH(event: APIEvent) {
  const id =
    event.params?.id || new URL(event.request.url).pathname.split("/").pop();
  const parsed = idParam.safeParse({ id });
  if (!parsed.success) return json({ error: "Invalid id" }, { status: 400 });
  const body = patchSchema.safeParse(
    await event.request.json().catch(() => ({}))
  );
  if (!body.success)
    return json({ error: body.error.message }, { status: 400 });

  const updated = await prisma.embeddingRun
    .update({
      where: { id: parsed.data.id },
      data: body.data,
      select: {
        id: true,
        model: true,
        dims: true,
        params: true,
        createdAt: true,
      },
    })
    .catch(() => null);
  if (!updated) return json({ error: "Not found" }, { status: 404 });
  return json(updated);
}

export async function DELETE(event: APIEvent) {
  const id =
    event.params?.id || new URL(event.request.url).pathname.split("/").pop();
  const parsed = idParam.safeParse({ id });
  if (!parsed.success) return json({ error: "Invalid id" }, { status: 400 });
  // Delete embeddings then run
  await prisma.docEmbedding.deleteMany({
    where: { runId: parsed.data.id },
  });
  const deleted = await prisma.embeddingRun
    .delete({
      where: { id: parsed.data.id },
      select: { id: true },
    })
    .catch(() => null);
  if (!deleted) return json({ error: "Not found" }, { status: 404 });
  return json({ ok: true, id: deleted.id });
}

// Process additional (missing) docs for this embedding run
const processMoreSchema = z.object({
  limit: z.number().int().positive().max(500).optional(),
  model: z.string().optional(),
});

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
  return Math.max(1, Math.round(s.length / 3));
}

async function embedBatched(
  texts: string[],
  model: string
): Promise<number[][]> {
  const MAX_BATCH_TOKENS = 7500;
  const PER_ITEM_TOKEN_LIMIT = 7400;

  function truncateToTokenLimit(s: string, maxTokens: number): string {
    const maxChars = Math.max(32, maxTokens * 3);
    if (estimateTokensApprox(s) <= maxTokens) return s;
    return s.slice(0, maxChars).trim();
  }

  const result: number[][] = new Array(texts.length).fill(null as any);
  let cursor = 0;
  while (cursor < texts.length) {
    let tokenSum = 0;
    const batchTexts: string[] = [];
    const batchIdxs: number[] = [];
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
    if (!batchTexts.length) {
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
      console.log(`[embeddings] batch failed, falling back to singles`, err);
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
  for (let i = 0; i < result.length; i++) {
    if (!Array.isArray(result[i])) result[i] = [];
  }
  return result;
}

export async function POST(event: APIEvent) {
  if (!serverEnv.OPENAI_API_KEY) {
    return json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }
  const id =
    event.params?.id || new URL(event.request.url).pathname.split("/").pop();
  const parsed = idParam.safeParse({ id });
  if (!parsed.success) return json({ error: "Invalid id" }, { status: 400 });

  try {
    const body = processMoreSchema.parse(
      await event.request.json().catch(() => ({}))
    );
    const batchSize = Math.min(500, Math.max(1, body.limit ?? 100));

    const run = await prisma.embeddingRun.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, model: true, dims: true, params: true },
    });
    if (!run) return json({ error: "Not found" }, { status: 404 });

    // Determine which docs are not yet embedded for this run
    const embedded = await prisma.docEmbedding.findMany({
      where: { runId: run.id },
      select: { docId: true },
    });
    const embeddedIds = new Set<string>(
      embedded.map((e: any) => String(e.docId))
    );

    const docs = await prisma.doc.findMany({
      where: { id: { notIn: Array.from(embeddedIds) } },
      select: { id: true, title: true, markdown: true },
      orderBy: { createdAt: "asc" },
      take: batchSize,
    });

    if (!docs.length) {
      const totalDocs = await prisma.doc.count();
      const have = embeddedIds.size;
      return json({
        addedDocs: 0,
        addedSections: 0,
        remaining: Math.max(0, totalDocs - have),
      });
    }

    const model = body.model || run.model;
    const flags: PreprocessFlags | undefined = (run.params as any) || undefined;
    const chunkCfg: ChunkerConfig | undefined =
      (run.params as any) || undefined;

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

    // Upsert DocSection entries
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

    console.log(
      `[embeddings] Creating section embeddings for`,
      validChunks.length,
      `chunks`
    );
    const vectors = validChunks.length
      ? await embedBatched(
          validChunks.map((c) => c.text),
          model
        )
      : [];

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

    // Pooled doc embeddings
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

    const totalDocs = await prisma.doc.count();
    const have = await prisma.docEmbedding.count({ where: { runId: run.id } });
    return json(
      {
        addedDocs: docRows.length,
        addedSections: sectionEmbRows.length,
        remaining: Math.max(0, totalDocs - have),
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = (e as Error).message || "Failed to process more docs";
    return json({ error: msg }, { status: 400 });
  }
}
