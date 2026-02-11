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
    const startMs = Date.now();
    const term = (q.q || "").trim();
    if (!term) return [];

    const termLower = term.toLowerCase();
    const terms = tokenizeQuery(termLower);
    if (!terms.length) return [];

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

    const titlePathDocs = await prisma.doc.findMany({
      where: {
        ...docFilters,
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { path: { contains: term, mode: "insensitive" } },
          ...terms.map((token) => ({
            title: { contains: token, mode: "insensitive" as const },
          })),
          ...terms.map((token) => ({
            path: { contains: token, mode: "insensitive" as const },
          })),
        ],
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        path: true,
      },
      take: Math.min(Math.max(take * 4, 120), 800),
    });
    const afterTitlePathMs = Date.now();

    const sections = await prisma.docSection.findMany({
      where: {
        OR: [
          { text: { contains: term, mode: "insensitive" } },
          ...terms.map((token) => ({
            text: { contains: token, mode: "insensitive" as const },
          })),
        ],
        ...(Object.keys(docFilters).length ? { doc: docFilters } : {}),
      },
      select: {
        id: true,
        text: true,
        doc: {
          select: { id: true, title: true, updatedAt: true, path: true },
        },
      },
      take: Math.min(Math.max(take * 8, 320), 1200),
    });
    const afterSectionsMs = Date.now();

    type RankedHit = { item: ServerSearchItem; score: number };
    const hitsMap = new Map<string, RankedHit>();

    for (const d of titlePathDocs) {
      const item: ServerSearchItem = {
        id: d.id,
        title: d.title,
        createdAt: d.updatedAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        path: d.path,
        snippet: undefined,
      };
      const score = scoreTitleAndPath({
        title: d.title ?? "",
        path: d.path ?? "",
        termLower,
        terms,
      });
      hitsMap.set(d.id, { item, score });
    }

    for (const s of sections) {
      const d = s.doc;
      if (!d) continue;
      const text = s.text || "";
      const sectionScore = scoreSectionText(text, termLower, terms);
      if (sectionScore <= 0) continue;

      const snippet = buildSnippet(text, termLower, terms);
      const existing = hitsMap.get(d.id);
      if (!existing) {
        hitsMap.set(d.id, {
          item: {
            id: d.id,
            title: d.title,
            createdAt: d.updatedAt.toISOString(),
            updatedAt: d.updatedAt.toISOString(),
            path: d.path,
            snippet,
          },
          score:
            scoreTitleAndPath({
              title: d.title ?? "",
              path: d.path ?? "",
              termLower,
              terms,
            }) + sectionScore,
        });
        continue;
      }

      if (snippet && !existing.item.snippet) existing.item.snippet = snippet;
      existing.score += sectionScore;
      hitsMap.set(d.id, existing);
    }

    const items = Array.from(hitsMap.values())
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (
          new Date(b.item.updatedAt).getTime() -
          new Date(a.item.updatedAt).getTime()
        );
      })
      .slice(0, take)
      .map((x) => x.item);

    try {
      console.log(
        `[docs.search] q="${term}" items=${items.length} take=${take} titlePath=${titlePathDocs.length} sections=${sections.length} msTotal=${Date.now() - startMs} msTitlePath=${afterTitlePathMs - startMs} msSections=${afterSectionsMs - afterTitlePathMs}`
      );
    } catch {}
    return items;
  },
  "docs-index-search"
);

function tokenizeQuery(termLower: string): string[] {
  return termLower
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2)
    .slice(0, 8);
}

function scoreTitleAndPath(input: {
  title: string;
  path: string;
  termLower: string;
  terms: string[];
}): number {
  const titleLower = input.title.toLowerCase();
  const pathLower = input.path.toLowerCase();
  let score = 0;

  if (titleLower === input.termLower) score += 450;
  if (pathLower === input.termLower) score += 420;
  if (titleLower.includes(input.termLower)) score += 210;
  if (pathLower.includes(input.termLower)) score += 190;
  if (titleLower.startsWith(input.termLower)) score += 80;
  if (pathLower.startsWith(input.termLower)) score += 95;

  for (const token of input.terms) {
    if (titleLower.includes(token)) score += 72;
    if (pathLower.includes(token)) score += 68;
    if (titleLower.startsWith(token)) score += 20;
    if (pathLower.startsWith(token)) score += 30;
    const segmentHit = pathLower
      .split("/")
      .some((segment) => segment === token);
    if (segmentHit) score += 35;
  }

  return score;
}

function scoreSectionText(
  text: string,
  termLower: string,
  terms: string[]
): number {
  const lower = text.toLowerCase();
  let score = 0;

  const fullIdx = lower.indexOf(termLower);
  if (fullIdx >= 0) {
    score += 140;
    score += Math.max(0, 35 - Math.floor(fullIdx / 80));
  }

  for (const token of terms) {
    const idx = lower.indexOf(token);
    if (idx >= 0) {
      score += 22;
      score += Math.max(0, 8 - Math.floor(idx / 120));
    }
  }

  return score;
}

function buildSnippet(
  text: string,
  qLower: string,
  terms: string[]
): string | undefined {
  const lower = text.toLowerCase();
  let idx = lower.indexOf(qLower);
  let matchLength = qLower.length;

  if (idx < 0) {
    for (const token of terms) {
      idx = lower.indexOf(token);
      if (idx >= 0) {
        matchLength = token.length;
        break;
      }
    }
  }

  if (idx < 0) return undefined;

  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + matchLength + 60);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  return prefix + text.slice(start, end) + suffix;
}
