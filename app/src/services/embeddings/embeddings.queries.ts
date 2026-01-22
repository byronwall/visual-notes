import { query } from "@solidjs/router";
import { prisma } from "~/server/db";

export type EmbeddingRunSummary = {
  id: string;
  model: string;
  dims: number;
  params: Record<string, unknown> | null;
  createdAt: string;
  count: number;
};

export type EmbeddingRunDetail = {
  id: string;
  model: string;
  dims: number;
  params: Record<string, unknown> | null;
  createdAt: string;
  count: number;
  sectionCount?: number;
  remaining?: number;
  changedEligible?: number;
  docs?: {
    items: { id: string; title: string; embeddedAt: string }[];
    limit: number;
    offset: number;
  };
};

export type EmbeddingRunQuery = {
  id: string;
  includeDocs?: boolean;
  limit?: number;
  offset?: number;
};

export type EmbeddingRunsQuery = { limit?: number };

export type DocSectionItem = {
  id: string;
  headingPath: string[];
  orderIndex: number;
  charCount: number;
  preview: string;
  embedded?: boolean;
};

export type DocSectionsQuery = { docId: string; runId?: string };

export const fetchEmbeddingRuns = query(
  async (input: EmbeddingRunsQuery = {}): Promise<EmbeddingRunSummary[]> => {
    "use server";
    const limit = Math.min(200, Math.max(1, Number(input.limit ?? 20)));
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
    const runIds = runs.map((r) => r.id);
    let idToCount: Record<string, number> = {};
    if (runIds.length) {
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
    return runs.map((r) => ({
      id: r.id,
      model: r.model,
      dims: r.dims,
      params: r.params as Record<string, unknown> | null,
      createdAt: r.createdAt.toISOString(),
      count: idToCount[r.id] ?? 0,
    }));
  },
  "embedding-runs"
);

export const fetchEmbeddingRun = query(
  async (input: EmbeddingRunQuery): Promise<EmbeddingRunDetail | null> => {
    "use server";
    if (!input?.id) return null;
    const includeDocs = Boolean(input.includeDocs);
    const limit = Math.min(500, Math.max(1, Number(input.limit ?? 50)));
    const offset = Math.max(0, Number(input.offset ?? 0));

    const run = await prisma.embeddingRun.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        model: true,
        dims: true,
        params: true,
        createdAt: true,
      },
    });
    if (!run) return null;

    const count = await prisma.docEmbedding.count({
      where: { runId: run.id },
    });
    const sectionCount = await prisma.docSectionEmbedding
      .count({ where: { runId: run.id } })
      .catch(() => 0);
    const totalDocs = await prisma.doc.count();
    const remaining = Math.max(0, totalDocs - count);

    let changedEligible = 0;
    try {
      const rows = (await prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int AS c
        FROM "DocEmbedding" de
        JOIN "Doc" d ON d."id" = de."docId"
        WHERE de."runId" = ${run.id}
          AND d."updatedAt" > de."createdAt";
      `) as any[];
      changedEligible = Number(rows?.[0]?.c || 0);
    } catch (e) {
      console.log("[embeddings] failed to count changedEligible", e);
      changedEligible = 0;
    }

    if (!includeDocs) {
      return {
        id: run.id,
        model: run.model,
        dims: run.dims,
        params: run.params as Record<string, unknown> | null,
        createdAt: run.createdAt.toISOString(),
        count,
        sectionCount,
        remaining,
        changedEligible,
      };
    }

    const rows = await prisma.docEmbedding.findMany({
      where: { runId: run.id },
      select: { docId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: limit,
      skip: offset,
    });
    const docIds = rows.map((r) => r.docId);
    const docs = docIds.length
      ? await prisma.doc.findMany({
          where: { id: { in: docIds } },
          select: { id: true, title: true },
        })
      : [];
    const byId = new Map(
      docs.map((d) => [String(d.id), { id: String(d.id), title: String(d.title) }])
    );
    const items = rows.map((r) => ({
      id: r.docId,
      title: byId.get(r.docId)?.title || "(untitled)",
      embeddedAt: r.createdAt.toISOString(),
    }));

    return {
      id: run.id,
      model: run.model,
      dims: run.dims,
      params: run.params as Record<string, unknown> | null,
      createdAt: run.createdAt.toISOString(),
      count,
      sectionCount,
      remaining,
      changedEligible,
      docs: { items, limit, offset },
    };
  },
  "embedding-run"
);

export const fetchDocSections = query(
  async (input: DocSectionsQuery): Promise<DocSectionItem[]> => {
    "use server";
    if (!input?.docId) return [];

    const sections = await prisma.docSection.findMany({
      where: { docId: input.docId },
      select: {
        id: true,
        headingPath: true,
        orderIndex: true,
        charCount: true,
        text: true,
      },
      orderBy: { orderIndex: "asc" },
    });

    if (!input.runId) {
      return sections.map((s) => ({
        id: s.id,
        headingPath: s.headingPath,
        orderIndex: s.orderIndex,
        charCount: s.charCount,
        preview: s.text.slice(0, 280),
      }));
    }

    const embedded = await prisma.docSectionEmbedding.findMany({
      where: { docId: input.docId, runId: input.runId },
      select: { sectionId: true },
    });
    const embeddedIds = new Set(embedded.map((e) => e.sectionId));

    return sections.map((s) => ({
      id: s.id,
      headingPath: s.headingPath,
      orderIndex: s.orderIndex,
      charCount: s.charCount,
      preview: s.text.slice(0, 280),
      embedded: embeddedIds.has(s.id),
    }));
  },
  "embedding-doc-sections"
);
