import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import type { DocItem } from "~/types/notes";

export type DocDetail = {
  id: string;
  title: string;
  markdown?: string | null;
  html?: string | null;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  originalSource?: string | null;
  originalContentId?: string | null;
  createdAt: string;
  updatedAt: string;
};

function getIdFromNotionId(id: string) {
  let initialId = decodeURIComponent(id.slice("__NOTION__".length));
  if (initialId.endsWith(".md")) {
    initialId = initialId.slice(0, -3);
  }
  return initialId;
}

export const fetchDoc = query(async (id: string): Promise<DocDetail> => {
  "use server";
  const docId = String(id || "");
  if (!docId) throw new Error("Missing id");
  const isNotionId = docId.startsWith("__NOTION__");
  const resolvedDoc = isNotionId
    ? await prisma.doc.findFirst({
        where: { originalContentId: getIdFromNotionId(docId) },
      })
    : await prisma.doc.findUnique({ where: { id: docId } });
  if (!resolvedDoc) throw new Error("Not found");
  try {
    const html = String(resolvedDoc.html || "");
    const imgCount = (html.match(/<img\b/gi) || []).length;
    const dataImgCount = (html.match(/<img[^>]*src=["']data:/gi) || []).length;
    console.log(
      "[docs.get] doc:%s html len:%d imgs:%d dataImgs:%d",
      resolvedDoc.id,
      html.length,
      imgCount,
      dataImgCount
    );
  } catch {}
  return {
    id: resolvedDoc.id,
    title: resolvedDoc.title,
    markdown: resolvedDoc.markdown,
    html: resolvedDoc.html,
    path: resolvedDoc.path,
    meta: resolvedDoc.meta as Record<string, unknown> | null,
    originalSource: resolvedDoc.originalSource,
    originalContentId: resolvedDoc.originalContentId,
    createdAt: resolvedDoc.createdAt.toISOString(),
    updatedAt: resolvedDoc.updatedAt.toISOString(),
  };
}, "docs-get");

export const fetchDocs = query(
  async (input?: { take?: number }): Promise<DocItem[]> => {
    "use server";
    const take = Math.max(1, Math.min(8000, input?.take ?? 8000));
    const items = await prisma.doc.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, createdAt: true, path: true },
      take,
    });
    try {
      console.log(`[services] fetchDocs: loaded ${items.length} docs`);
    } catch {}
    return items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    }));
  },
  "docs-list"
);

export const fetchPathSuggestions = query(
  async (): Promise<{ path: string; count: number }[]> => {
    "use server";
    const groups = await prisma.doc.groupBy({
      by: ["path"],
      _count: { _all: true },
      where: { path: { not: null } },
    });
    const items = groups
      .filter((g) => typeof g.path === "string")
      .map((g) => ({
        path: g.path as string,
        count: (g as unknown as { _count: { _all: number } })._count._all,
      }))
      .sort((a, b) => b.count - a.count);
    console.log(`[services] fetchPathSuggestions: count=${items.length}`);
    return items;
  },
  "docs-paths"
);

export const fetchMetaKeys = query(
  async (): Promise<{ key: string; count: number }[]> => {
    "use server";
    const docs = await prisma.doc.findMany({
      where: { meta: { not: null } as any },
      select: { meta: true },
    });
    const counts = new Map<string, number>();
    for (const d of docs as any[]) {
      const m = d.meta;
      if (!m || typeof m !== "object") continue;
      for (const k of Object.keys(m)) {
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
    const items = Array.from(counts.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
    console.log(`[services] fetchMetaKeys: count=${items.length}`);
    return items;
  },
  "docs-meta-keys"
);

export const fetchMetaValues = query(
  async (key: string): Promise<{ value: string; count: number }[]> => {
    "use server";
    if (!key) return [];
    const docs = await prisma.doc.findMany({
      where: { meta: { path: [key], not: null } as any },
      select: { meta: true },
    });
    const counts = new Map<string, number>();
    for (const d of docs as any[]) {
      const m = d.meta as Record<string, unknown> | null;
      if (!m || typeof m !== "object") continue;
      const raw = (m as any)[key];
      if (raw === null || raw === undefined) continue;
      const val = String(raw);
      counts.set(val, (counts.get(val) || 0) + 1);
    }
    const items = Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
    console.log(`[services] fetchMetaValues: key=${key} count=${items.length}`);
    return items;
  },
  "docs-meta-values"
);
