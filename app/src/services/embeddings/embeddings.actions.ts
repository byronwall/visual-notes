import { action } from "@solidjs/router";
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

export const createEmbeddingRun = action(
  async (payload: z.infer<typeof createSchema>) => {
    "use server";
    if (!serverEnv.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }
    const { model, dims, params } = createSchema.parse(payload);
    const useModel = model || serverEnv.EMBEDDING_MODEL || "text-embedding-3-small";

    const docs = await prisma.doc.findMany({
      select: { id: true, title: true, markdown: true },
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

    return {
      runId: run.id,
      docCount: docRows.length,
      sectionCount: sectionEmbRows.length,
    };
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

    const run = await prisma.embeddingRun.findUnique({
      where: { id: input.id },
      select: { id: true, model: true, dims: true, params: true },
    });
    if (!run) throw new Error("Not found");

    let docs: { id: string; title: string; markdown: string }[] = [];
    if (mode === "missing") {
      const embedded = await prisma.docEmbedding.findMany({
        where: { runId: run.id },
        select: { docId: true },
      });
      const embeddedIds = new Set<string>(
        embedded.map((e: any) => String(e.docId))
      );
      docs = (await prisma.doc.findMany({
        where: { id: { notIn: Array.from(embeddedIds) } },
        select: { id: true, title: true, markdown: true },
        orderBy: { createdAt: "asc" },
        take: batchSize,
      })) as any;
    } else {
      try {
        const rows = (await prisma.$queryRaw<any[]>`
          SELECT d."id"::text AS id, d."title"::text AS title, d."markdown"::text AS markdown
          FROM "DocEmbedding" de
          JOIN "Doc" d ON d."id" = de."docId"
          WHERE de."runId" = ${run.id}
            AND d."updatedAt" > de."createdAt"
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
        const totalDocs = await prisma.doc.count();
        const have = await prisma.docEmbedding.count({ where: { runId: run.id } });
        return {
          addedDocs: 0,
          addedSections: 0,
          remaining: Math.max(0, totalDocs - have),
        };
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
      return { addedDocs: 0, addedSections: 0, remaining: changedRemaining };
    }

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
      }
    }

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

    if (mode === "missing") {
      const totalDocs = await prisma.doc.count();
      const have = await prisma.docEmbedding.count({ where: { runId: run.id } });
      return {
        addedDocs: docRows.length,
        addedSections: sectionEmbRows.length,
        remaining: Math.max(0, totalDocs - have),
      };
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

    return {
      addedDocs: docRows.length,
      addedSections: sectionEmbRows.length,
      remaining: changedRemaining,
    };
  },
  "embedding-run-process"
);
