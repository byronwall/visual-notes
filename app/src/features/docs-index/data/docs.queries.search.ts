import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
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
    activityClass?: "READ_HEAVY" | "EDIT_HEAVY" | "BALANCED" | "COLD";
    sortMode?:
      | "relevance"
      | "recent_activity"
      | "most_viewed_30d"
      | "most_edited_30d";
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
      activityClass: q.activityClass,
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

    type RankedHit = {
      item: ServerSearchItem;
      score: number;
      tokenHits: Set<string>;
      hasExactTerm: boolean;
    };
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
      hitsMap.set(d.id, {
        item,
        score,
        tokenHits: collectTokenHits(`${d.title ?? ""} ${d.path ?? ""}`, terms),
        hasExactTerm: includesNormalized(d.title ?? "", termLower),
      });
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
        const textTokenHits = collectTokenHits(text, terms);
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
          tokenHits: new Set([
            ...collectTokenHits(`${d.title ?? ""} ${d.path ?? ""}`, terms),
            ...textTokenHits,
          ]),
          hasExactTerm:
            includesNormalized(d.title ?? "", termLower) ||
            includesNormalized(text, termLower),
        });
        continue;
      }

      if (snippet && !existing.item.snippet) existing.item.snippet = snippet;
      existing.score += sectionScore;
      mergeTokenHits(existing.tokenHits, collectTokenHits(text, terms));
      if (!existing.hasExactTerm && includesNormalized(text, termLower)) {
        existing.hasExactTerm = true;
      }
      hitsMap.set(d.id, existing);
    }

    const docIds = Array.from(hitsMap.keys());
    const snapshots = docIds.length
      ? await prisma.docActivitySnapshot.findMany({
          where: { docId: { in: docIds } },
          select: {
            docId: true,
            views30d: true,
            edits30d: true,
            searchClicks30d: true,
            lastInteractedAt: true,
          },
        })
      : [];
    const snapshotByDocId = new Map(snapshots.map((s) => [s.docId, s]));
    const nowMs = Date.now();
    const sortMode = q.sortMode ?? "relevance";
    const W_TEXT = 1.35;

    const items = Array.from(hitsMap.values())
      .filter((entry) => {
        if (terms.length <= 1) return true;
        if (entry.hasExactTerm) return true;
        return entry.tokenHits.size >= terms.length;
      })
      .map((entry) => {
        const snapshot = snapshotByDocId.get(entry.item.id);
        const viewsBoost = Math.min(140, Math.log1p(snapshot?.views30d ?? 0) * 28);
        const editsBoost = Math.min(150, Math.log1p(snapshot?.edits30d ?? 0) * 35);
        const intentBoost = Math.min(
          90,
          Math.log1p(snapshot?.searchClicks30d ?? 0) * 24
        );
        const recencyBoost = snapshot?.lastInteractedAt
          ? Math.max(
              0,
              120 - Math.floor((nowMs - snapshot.lastInteractedAt.getTime()) / (12 * 60 * 60 * 1000))
            )
          : 0;
        const blendedScore =
          entry.score * W_TEXT +
          recencyBoost * 0.65 +
          viewsBoost * 0.55 +
          editsBoost * 0.65 +
          intentBoost * 0.5;
        return {
          item: entry.item,
          blendedScore,
          views30d: snapshot?.views30d ?? 0,
          edits30d: snapshot?.edits30d ?? 0,
          lastInteractedAt: snapshot?.lastInteractedAt?.getTime() ?? 0,
        };
      })
      .sort((a, b) => {
        if (sortMode === "most_viewed_30d") {
          if (b.views30d !== a.views30d) return b.views30d - a.views30d;
        } else if (sortMode === "most_edited_30d") {
          if (b.edits30d !== a.edits30d) return b.edits30d - a.edits30d;
        } else if (sortMode === "recent_activity") {
          if (b.lastInteractedAt !== a.lastInteractedAt) {
            return b.lastInteractedAt - a.lastInteractedAt;
          }
        } else if (b.blendedScore !== a.blendedScore) {
          return b.blendedScore - a.blendedScore;
        }
        return (
          new Date(b.item.updatedAt).getTime() -
          new Date(a.item.updatedAt).getTime()
        );
      })
      .slice(0, take)
      .map((x) => x.item);

    await logActionEvent({
      eventType: "search.query.executed",
      entityType: "search",
      payload: {
        queryPreview: term.slice(0, 120),
        queryLength: term.length,
        tokenCount: terms.length,
        resultCount: items.length,
        filtersHash: JSON.stringify({
          pathPrefix: q.pathPrefix ?? "",
          pathBlankOnly: Boolean(q.pathBlankOnly),
          metaKey: q.metaKey ?? "",
          source: q.source ?? "",
          activityClass: q.activityClass ?? "",
        }).length,
      },
    });
    console.log("[docs.search] query processed", {
      msTotal: Date.now() - startMs,
      msTitlePath: afterTitlePathMs - startMs,
      msSections: afterSectionsMs - afterTitlePathMs,
      take,
      resultCount: items.length,
      sortMode,
    });
    return items;
  },
  "docs-index-search"
);

function tokenizeQuery(termLower: string): string[] {
  const raw = termLower
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2)
    .slice(0, 8);
  const expanded: string[] = [];
  for (const token of raw) {
    expanded.push(token);
    if (token.endsWith("s") && token.length >= 4) {
      expanded.push(token.slice(0, -1));
    }
  }
  return Array.from(new Set(expanded)).slice(0, 10);
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
  if (titleLower.includes(input.termLower)) score += 260;
  if (pathLower.includes(input.termLower)) score += 210;
  if (titleLower.startsWith(input.termLower)) score += 80;
  if (pathLower.startsWith(input.termLower)) score += 95;
  if (includesNormalized(input.title, input.termLower)) score += 75;
  if (includesNormalized(input.path, input.termLower)) score += 45;

  for (const token of input.terms) {
    if (titleLower.includes(token)) score += 86;
    if (pathLower.includes(token)) score += 70;
    if (titleLower.startsWith(token)) score += 28;
    if (pathLower.startsWith(token)) score += 30;
    const segmentHit = pathLower
      .split("/")
      .some((segment) => segment === token);
    if (segmentHit) score += 35;
    if (includesNormalized(input.title, token)) score += 40;
    if (includesNormalized(input.path, token)) score += 24;
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

function includesNormalized(text: string, needleLower: string): boolean {
  if (!text || !needleLower) return false;
  const normalizedText = normalizeForContains(text);
  const normalizedNeedle = normalizeForContains(needleLower);
  return normalizedText.includes(normalizedNeedle);
}

function normalizeForContains(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectTokenHits(text: string, terms: string[]): Set<string> {
  const normalized = normalizeForContains(text);
  const hits = new Set<string>();
  for (const token of terms) {
    if (normalized.includes(token)) hits.add(token);
  }
  return hits;
}

function mergeTokenHits(base: Set<string>, incoming: Set<string>): void {
  for (const token of incoming) base.add(token);
}
