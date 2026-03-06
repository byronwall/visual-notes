import { action } from "@solidjs/router";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { prisma } from "~/server/db";
import { serverEnv } from "~/env/server";
import {
  preprocessMarkdown,
  type PreprocessFlags,
} from "~/server/lib/embedding/preprocess";
import { makeChunks, type ChunkerConfig } from "~/server/lib/embedding/chunker";
import { sha256 } from "~/server/lib/embedding/hash";
import { meanPool } from "~/server/lib/embedding/pool";
import { embedBatched } from "~/services/embeddings/embeddings.utils";
import { projectVectorsIntoUmapRun } from "~/services/umap/umap.projection";

const createSchema = z.object({
  model: z.string().optional(),
  dims: z.number().int().positive().optional(),
  params: z.record(z.any()).optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  model: z.string().optional(),
  dims: z.number().int().positive().optional(),
  params: z.record(z.any()).optional(),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

const processSchema = z.object({
  id: z.string().min(1),
  limit: z.number().int().positive().max(500).optional(),
  model: z.string().optional(),
  mode: z.enum(["missing", "changed"]).optional(),
});

function normalizeSourceForEmbedding(input: {
  html?: string | null;
  markdown?: string | null;
}): string {
  const html = String(input.html || "").trim();
  if (html.length > 0) {
    // For embedding, treat HTML as canonical when present and strip all tags.
    return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
      .replace(/\s+/g, " ")
      .trim();
  }
  return String(input.markdown || "");
}

export const createEmbeddingRun = action(
  async (payload: z.infer<typeof createSchema>) => {
    "use server";
    if (!serverEnv.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }
    const { model, dims, params } = createSchema.parse(payload);
    const useModel = model || serverEnv.EMBEDDING_MODEL || "text-embedding-3-small";
    console.info("[embeddings.action] createEmbeddingRun:start", {
      model: useModel,
      dims: dims ?? null,
    });

    const docs = await prisma.doc.findMany({
      select: { id: true, title: true, markdown: true, html: true },
      orderBy: { createdAt: "asc" },
    });

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
        const sourceText = normalizeSourceForEmbedding(d);
        const sections = preprocessMarkdown(sourceText, flags);
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
      }
    }

    const run = await prisma.embeddingRun.create({
      data: { model: useModel, dims: dims || 1536, params: params ?? {} },
      select: { id: true },
    });

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
          useModel
        )
      : [];
    const inferredDims = vectors[0]?.length ?? (dims || 1536);
    if (!dims && inferredDims) {
      await prisma.embeddingRun.update({
        where: { id: run.id },
        data: { dims: inferredDims },
      });
    }

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

    const result = {
      runId: run.id,
      docCount: docRows.length,
      sectionCount: sectionEmbRows.length,
    };
    console.info("[embeddings.action] createEmbeddingRun:done", result);
    return result;
  },
  "embedding-run-create"
);

export const updateEmbeddingRun = action(
  async (payload: z.infer<typeof updateSchema>) => {
    "use server";
    const input = updateSchema.parse(payload);
    const updated = await prisma.embeddingRun
      .update({
        where: { id: input.id },
        data: {
          model: input.model,
          dims: input.dims,
          params: input.params,
        },
        select: {
          id: true,
          model: true,
          dims: true,
          params: true,
          createdAt: true,
        },
      })
      .catch(() => null);
    if (!updated) throw new Error("Not found");
    return {
      id: updated.id,
      model: updated.model,
      dims: updated.dims,
      params: updated.params as Record<string, unknown> | null,
      createdAt: updated.createdAt.toISOString(),
    };
  },
  "embedding-run-update"
);

export const deleteEmbeddingRun = action(
  async (payload: z.infer<typeof deleteSchema>) => {
    "use server";
    const input = deleteSchema.parse(payload);
    await prisma.docEmbedding.deleteMany({
      where: { runId: input.id },
    });
    const deleted = await prisma.embeddingRun
      .delete({ where: { id: input.id }, select: { id: true } })
      .catch(() => null);
    if (!deleted) throw new Error("Not found");
    return { ok: true, id: deleted.id };
  },
  "embedding-run-delete"
);

export const processEmbeddingRun = action(
  async (payload: z.infer<typeof processSchema>) => {
    "use server";
    if (!serverEnv.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }
    const input = processSchema.parse(payload);
    const batchSize = Math.min(500, Math.max(1, input.limit ?? 100));
    const mode = input.mode || "missing";
    console.info("[embeddings.action] processEmbeddingRun:start", {
      id: input.id,
      mode,
      batchSize,
    });

    const run = await prisma.embeddingRun.findUnique({
      where: { id: input.id },
      select: { id: true, model: true, dims: true, params: true },
    });
    if (!run) throw new Error("Not found");

    let docs: { id: string; title: string; markdown: string; html: string }[] = [];
    if (mode === "missing") {
      try {
        const rows = (await prisma.$queryRaw<any[]>`
          SELECT d."id"::text AS id, d."title"::text AS title, d."markdown"::text AS markdown, d."html"::text AS html
          FROM "Doc" d
          LEFT JOIN "DocEmbedding" de
            ON de."docId" = d."id"
           AND de."runId" = ${run.id}
          WHERE de."id" IS NULL
            AND (
              COALESCE(TRIM(d."markdown"), '') <> ''
              OR COALESCE(TRIM(d."html"), '') <> ''
            )
          ORDER BY d."createdAt" ASC
          LIMIT ${batchSize};
        `) as any[];
        docs = rows as any;
      } catch (err) {
        console.log("[embeddings] failed to select missing eligible docs", err);
        docs = [] as any;
      }
    } else {
      try {
        const rows = (await prisma.$queryRaw<any[]>`
          SELECT d."id"::text AS id, d."title"::text AS title, d."markdown"::text AS markdown, d."html"::text AS html
          FROM "DocEmbedding" de
          JOIN "Doc" d ON d."id" = de."docId"
          WHERE de."runId" = ${run.id}
            AND d."updatedAt" > de."createdAt"
            AND (
              COALESCE(TRIM(d."markdown"), '') <> ''
              OR COALESCE(TRIM(d."html"), '') <> ''
            )
          ORDER BY d."updatedAt" ASC
          LIMIT ${batchSize};
        `) as any[];
        docs = rows as any;
      } catch (err) {
        console.log("[embeddings] failed to select changed docs", err);
        docs = [] as any;
      }
    }

    if (!docs.length) {
      if (mode === "missing") {
        let remainingEligible = 0;
        try {
          const rows = (await prisma.$queryRaw<any[]>`
            SELECT COUNT(*)::int AS c
            FROM "Doc" d
            LEFT JOIN "DocEmbedding" de
              ON de."docId" = d."id"
             AND de."runId" = ${run.id}
            WHERE de."id" IS NULL
              AND (
                COALESCE(TRIM(d."markdown"), '') <> ''
                OR COALESCE(TRIM(d."html"), '') <> ''
              );
          `) as any[];
          remainingEligible = Number(rows?.[0]?.c || 0);
        } catch {}
        const result = {
          addedDocs: 0,
          addedSections: 0,
          remaining: remainingEligible,
        };
        console.info("[embeddings.action] processEmbeddingRun:done", {
          ...result,
          id: run.id,
          mode,
        });
        return result;
      }
      let changedRemaining = 0;
      try {
        const rows = (await prisma.$queryRaw<any[]>`
          SELECT COUNT(*)::int AS c
          FROM "DocEmbedding" de
          JOIN "Doc" d ON d."id" = de."docId"
          WHERE de."runId" = ${run.id}
            AND d."updatedAt" > de."createdAt";
        `) as any[];
        changedRemaining = Number(rows?.[0]?.c || 0);
      } catch {}
      const result = { addedDocs: 0, addedSections: 0, remaining: changedRemaining };
      console.info("[embeddings.action] processEmbeddingRun:done", {
        ...result,
        id: run.id,
        mode,
      });
      return result;
    }

    console.info("[embeddings.action] processEmbeddingRun:selectedDocs", {
      id: run.id,
      mode,
      docsSelected: docs.length,
      sampleDocIds: docs.slice(0, 5).map((d: any) => String(d.id)),
    });

    const model = input.model || run.model;
    const flags: PreprocessFlags | undefined = (run.params as any) || undefined;
    const chunkCfg: ChunkerConfig | undefined = (run.params as any) || undefined;

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
    if (mode === "changed") {
      const docIds = docs.map((d: any) => String(d.id));
      if (docIds.length) {
        await prisma.docSectionEmbedding.deleteMany({
          where: { runId: run.id, docId: { in: docIds } },
        });
        await prisma.docEmbedding.deleteMany({
          where: { runId: run.id, docId: { in: docIds } },
        });
      }
    }
    for (const d of docs as any[]) {
      try {
        const sourceText = normalizeSourceForEmbedding(d);
        const sections = preprocessMarkdown(sourceText, flags);
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
      }
    }
    console.info("[embeddings.action] processEmbeddingRun:chunked", {
      id: run.id,
      mode,
      docsSelected: docs.length,
      chunksPrepared: allChunks.length,
    });

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
      }
    }
    if (!validChunks.length && docs.length > 0) {
      console.warn("[embeddings.action] processEmbeddingRun:noValidChunks", {
        id: run.id,
        mode,
        docsSelected: docs.length,
        sampleDocIds: docs.slice(0, 10).map((d: any) => String(d.id)),
      });
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

    let umapProjectionSummary:
      | { runsUpdated: number; pointsProjected: number; failedRuns: number }
      | undefined;
    if (docRows.length) {
      const trainedRuns = await prisma.umapRun.findMany({
        where: {
          embeddingRunId: run.id,
          artifactPath: { not: null },
        },
        select: { id: true },
      });
      if (trainedRuns.length) {
        let runsUpdated = 0;
        let pointsProjected = 0;
        let failedRuns = 0;
        const rows = docRows.map((row) => ({
          docId: row.docId,
          vector: row.vector,
        }));

        for (const umapRun of trainedRuns) {
          try {
            const projected = await projectVectorsIntoUmapRun({
              umapRunId: umapRun.id,
              rows,
              mode: "all",
            });
            if (projected.projected > 0) {
              runsUpdated += 1;
              pointsProjected += projected.projected;
            }
          } catch (error) {
            failedRuns += 1;
            console.warn(
              `[embeddings] failed UMAP projection run=${umapRun.id}`,
              error
            );
          }
        }

        umapProjectionSummary = {
          runsUpdated,
          pointsProjected,
          failedRuns,
        };
      }
    }

    if (mode === "missing") {
      let remainingEligible = 0;
      try {
        const rows = (await prisma.$queryRaw<any[]>`
          SELECT COUNT(*)::int AS c
          FROM "Doc" d
          LEFT JOIN "DocEmbedding" de
            ON de."docId" = d."id"
           AND de."runId" = ${run.id}
          WHERE de."id" IS NULL
            AND (
              COALESCE(TRIM(d."markdown"), '') <> ''
              OR COALESCE(TRIM(d."html"), '') <> ''
            );
        `) as any[];
        remainingEligible = Number(rows?.[0]?.c || 0);
      } catch {}
      const result = {
        addedDocs: docRows.length,
        addedSections: sectionEmbRows.length,
        remaining: remainingEligible,
        umapProjection: umapProjectionSummary,
      };
      console.info("[embeddings.action] processEmbeddingRun:done", {
        id: run.id,
        mode,
        addedDocs: result.addedDocs,
        addedSections: result.addedSections,
        remaining: result.remaining,
        projectedPoints: result.umapProjection?.pointsProjected ?? 0,
      });
      return result;
    }

    let changedRemaining = 0;
    try {
      const rows = (await prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int AS c
        FROM "DocEmbedding" de
        JOIN "Doc" d ON d."id" = de."docId"
        WHERE de."runId" = ${run.id}
          AND d."updatedAt" > de."createdAt";
      `) as any[];
      changedRemaining = Number(rows?.[0]?.c || 0);
    } catch {}

    const result = {
      addedDocs: docRows.length,
      addedSections: sectionEmbRows.length,
      remaining: changedRemaining,
      umapProjection: umapProjectionSummary,
    };
    console.info("[embeddings.action] processEmbeddingRun:done", {
      id: run.id,
      mode,
      addedDocs: result.addedDocs,
      addedSections: result.addedSections,
      remaining: result.remaining,
      projectedPoints: result.umapProjection?.pointsProjected ?? 0,
    });
    return result;
  },
  "embedding-run-process"
);
