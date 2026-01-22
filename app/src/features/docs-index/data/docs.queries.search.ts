import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import type { ServerSearchItem } from "./docs.types";
import {
  buildDocsWhere,
  toIsoDateEnd,
  toIsoDateStart,
} from "./docs.queries.shared";

export const searchDocs = query(
  async (q: {
    q: string;
    pathPrefix?: string;
    pathBlankOnly?: boolean;
    metaKey?: string;
    metaValue?: string;
    source?: string;
    originalContentId?: string;
    createdFrom?: string;
    createdTo?: string;
    updatedFrom?: string;
    updatedTo?: string;
    take?: number;
  }): Promise<ServerSearchItem[]> => {
    "use server";
    const term = (q.q || "").trim();
    if (!term) return [];

    const take = Math.max(1, Math.min(200, q.take ?? 50));
    const docFilters = buildDocsWhere({
      pathPrefix: q.pathPrefix,
      pathBlankOnly: q.pathBlankOnly,
      metaKey: q.metaKey,
      metaValue: q.metaValue,
      source: q.source,
      originalContentId: q.originalContentId,
      createdFrom: q.createdFrom ? toIsoDateStart(q.createdFrom) : undefined,
      createdTo: q.createdTo ? toIsoDateEnd(q.createdTo) : undefined,
      updatedFrom: q.updatedFrom ? toIsoDateStart(q.updatedFrom) : undefined,
      updatedTo: q.updatedTo ? toIsoDateEnd(q.updatedTo) : undefined,
    });

    const titleDocs = await prisma.doc.findMany({
      where: {
        ...docFilters,
        title: { contains: term, mode: "insensitive" },
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        path: true,
      },
      take,
    });

    const sections = await prisma.docSection.findMany({
      where: {
        text: { contains: term, mode: "insensitive" },
        ...(Object.keys(docFilters).length ? { doc: docFilters } : {}),
      },
      select: {
        id: true,
        text: true,
        doc: {
          select: { id: true, title: true, updatedAt: true, path: true },
        },
      },
      take: Math.min(take * 3, 500),
    });

    const termLower = term.toLowerCase();
    const hitsMap = new Map<string, ServerSearchItem>();

    for (const d of titleDocs) {
      hitsMap.set(d.id, {
        id: d.id,
        title: d.title,
        createdAt: d.updatedAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        path: d.path,
        snippet: undefined,
      });
      if (hitsMap.size >= take) break;
    }

    for (const s of sections) {
      if (hitsMap.size >= take) break;
      const d = s.doc;
      if (!d) continue;
      if (!hitsMap.has(d.id)) {
        const snippet = buildSnippet(s.text || "", termLower);
        hitsMap.set(d.id, {
          id: d.id,
          title: d.title,
          createdAt: d.updatedAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
          path: d.path,
          snippet,
        });
        if (hitsMap.size >= take) break;
      }
    }

    const items = Array.from(hitsMap.values()).sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    try {
      console.log(`[docs.search] q="${term}" items=${items.length}`);
    } catch {}
    return items;
  },
  "docs-index-search"
);

function buildSnippet(text: string, qLower: string): string | undefined {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx < 0) return undefined;
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + qLower.length + 60);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  return prefix + text.slice(start, end) + suffix;
}
