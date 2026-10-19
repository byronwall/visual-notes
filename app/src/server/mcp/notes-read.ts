import { searchDocs } from "~/features/docs-index/data/docs.queries.search";
import { prisma } from "~/server/db";
import { noteToMarkdown } from "./note-content";
import {
  CHATGPT_SOURCE,
  isChatGptNote,
  summarySelect,
  toSummary,
  type ConnectorContext,
  type NoteSummary,
} from "./notes-shared";
import { buildPathTree, normalizeNotePath, type PathCount } from "./paths";

export const MAX_NOTES_PER_GET = 10;

export type SearchResult = NoteSummary & { snippet: string | null };

export async function searchNotes(
  ctx: ConnectorContext,
  input: { query: string; path?: string; limit?: number },
): Promise<SearchResult[]> {
  const limit = clampLimit(input.limit, 10, 25);
  const hits = await searchDocs({
    q: input.query,
    pathPrefix: normalizeNotePath(input.path) ?? undefined,
    take: limit,
  });
  if (!hits.length) return [];
  const rows = await prisma.doc.findMany({
    where: { id: { in: hits.map((hit) => hit.id) } },
    select: summarySelect,
  });
  const rowById = new Map(rows.map((row) => [row.id, row]));
  return hits.flatMap((hit) => {
    const row = rowById.get(hit.id);
    if (!row) return [];
    return [{ ...toSummary(ctx, row), snippet: hit.snippet ?? null }];
  });
}

export async function listRecentNotes(
  ctx: ConnectorContext,
  input: {
    since?: string;
    path?: string;
    createdBy?: "chatgpt" | "any";
    limit?: number;
  },
): Promise<NoteSummary[]> {
  const since = input.since ? new Date(input.since) : null;
  const path = normalizeNotePath(input.path);
  const rows = await prisma.doc.findMany({
    where: {
      ...(since && !Number.isNaN(since.getTime())
        ? { updatedAt: { gte: since } }
        : {}),
      ...(path ? { OR: [{ path }, { path: { startsWith: `${path}.` } }] } : {}),
      ...(input.createdBy === "chatgpt"
        ? { originalSource: CHATGPT_SOURCE }
        : {}),
    },
    select: summarySelect,
    orderBy: { updatedAt: "desc" },
    take: clampLimit(input.limit, 20, 100),
  });
  return rows.map((row) => toSummary(ctx, row));
}

export async function listNotePaths(input: {
  prefix?: string;
}): Promise<PathCount[]> {
  const groups = await prisma.doc.groupBy({
    by: ["path"],
    where: { path: { not: null } },
    _count: { _all: true },
  });
  const rows = groups.flatMap((group) => {
    const path = normalizeNotePath(group.path);
    return path ? [{ path, count: group._count._all }] : [];
  });
  return buildPathTree(rows, input.prefix);
}

export type FullNote = NoteSummary & {
  markdown: string;
  createdAt: string;
  editable: boolean;
};

export async function getNotes(
  ctx: ConnectorContext,
  input: { ids: string[] },
): Promise<{ notes: FullNote[]; missing: string[] }> {
  const ids = Array.from(new Set(input.ids)).slice(0, MAX_NOTES_PER_GET);
  const rows = await prisma.doc.findMany({
    where: { id: { in: ids } },
    select: { ...summarySelect, createdAt: true, html: true, markdown: true },
  });
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const notes: FullNote[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const row = rowById.get(id);
    if (!row) {
      missing.push(id);
      continue;
    }
    notes.push({
      ...toSummary(ctx, row),
      markdown: noteToMarkdown(row),
      createdAt: row.createdAt.toISOString(),
      editable: isChatGptNote(row),
    });
  }
  return { notes, missing };
}

function clampLimit(
  value: number | undefined,
  fallback: number,
  max: number,
): number {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(value)));
}
