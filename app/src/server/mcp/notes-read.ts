import { searchDocs } from "~/features/docs-index/data/docs.queries.search";
import { prisma } from "~/server/db";
import { toMarkdown } from "~/lib/note-content/convert";
import { resolveNoteReferences } from "~/server/notes/note-links";
import { readNoteContent } from "~/server/notes/note-store";
import { collectionViewIds } from "~/lib/note-content/note-markdown";
import {
  CHATGPT_SOURCE,
  isChatGptNote,
  summarySelect,
  toSummary,
  type ConnectorContext,
  type NoteSummary,
} from "./notes-shared";
import { buildPathTree, normalizeNotePath, type PathCount } from "./paths";
import { fuseRankings, type FusedHit } from "./rank-fusion";
import { semanticSearch } from "./semantic";
import {
  collectionTextForNotes,
  type CollectionText,
} from "~/services/collections/collection-text";

export const MAX_NOTES_PER_GET = 10;

export type SearchResult = NoteSummary & {
  snippet: string | null;
  match: FusedHit["match"];
};

export async function searchNotes(
  ctx: ConnectorContext,
  input: { query: string; path?: string; limit?: number },
): Promise<SearchResult[]> {
  const limit = clampLimit(input.limit, 10, 25);
  const path = normalizeNotePath(input.path);
  const [keywordHits, semanticHits] = await Promise.all([
    searchDocs({ q: input.query, pathPrefix: path ?? undefined, take: limit }),
    semanticSearch(input.query, limit * 3),
  ]);
  const snippetById = new Map(
    keywordHits.map((hit) => [hit.id, hit.snippet ?? null]),
  );
  const candidates = fuseRankings(
    keywordHits.map((hit) => hit.id),
    (semanticHits ?? []).map((hit) => hit.id),
    limit * 3,
  );
  if (!candidates.length) return [];
  const rows = await prisma.doc.findMany({
    where: {
      id: { in: candidates.map((hit) => hit.id) },
      ...(path ? { OR: [{ path }, { path: { startsWith: `${path}.` } }] } : {}),
    },
    select: summarySelect,
  });
  const rowById = new Map(rows.map((row) => [row.id, row]));
  return candidates
    .flatMap((hit) => {
      const row = rowById.get(hit.id);
      if (!row) return [];
      return [
        {
          ...toSummary(ctx, row),
          snippet: snippetById.get(hit.id) ?? null,
          match: hit.match,
        },
      ];
    })
    .slice(0, limit);
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
  /** Set when the note is a row in a collection: its typed properties as text. */
  collection?: CollectionText;
  /** Collection views embedded in the note as `{{collection-view:id}}` lines. */
  embeds?: EmbeddedView[];
};

export type EmbeddedView = {
  viewId: string;
  view: string;
  type: string;
  collectionId: string;
  collection: string;
};

async function embeddedViews(viewIds: string[]): Promise<Map<string, EmbeddedView>> {
  if (!viewIds.length) return new Map();
  const views = await prisma.collectionView.findMany({
    where: { id: { in: viewIds } },
    select: {
      id: true,
      name: true,
      type: true,
      collectionId: true,
      collection: { select: { name: true } },
    },
  });
  return new Map(
    views.map((v) => [
      v.id,
      {
        viewId: v.id,
        view: v.name,
        type: v.type,
        collectionId: v.collectionId,
        collection: v.collection.name,
      },
    ]),
  );
}

export async function getNotes(
  ctx: ConnectorContext,
  input: { ids: string[] },
): Promise<{ notes: FullNote[]; missing: string[] }> {
  const ids = Array.from(new Set(input.ids)).slice(0, MAX_NOTES_PER_GET);
  const rows = await prisma.doc.findMany({
    where: { id: { in: ids } },
    select: {
      ...summarySelect,
      createdAt: true,
      html: true,
      markdown: true,
      content: true,
    },
  });
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const collectionText = await collectionTextForNotes(rows.map((r) => r.id));
  const contentById = new Map(rows.map((row) => [row.id, readNoteContent(row)]));
  const viewIdsById = new Map(
    rows.map((row) => [row.id, collectionViewIds(contentById.get(row.id)?.content ?? [])]),
  );
  const views = await embeddedViews([...new Set([...viewIdsById.values()].flat())]);
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
      markdown: toMarkdown(await resolveNoteReferences(contentById.get(id)!), {
        withIds: true,
      }),
      createdAt: row.createdAt.toISOString(),
      editable: isChatGptNote(row),
      ...(collectionText[id] ? { collection: collectionText[id] } : {}),
      ...embedsField(viewIdsById.get(id) ?? [], views),
    });
  }
  return { notes, missing };
}

function embedsField(viewIds: string[], views: Map<string, EmbeddedView>) {
  const embeds = viewIds.flatMap((id) => {
    const view = views.get(id);
    return view ? [view] : [];
  });
  return embeds.length ? { embeds } : {};
}

function clampLimit(
  value: number | undefined,
  fallback: number,
  max: number,
): number {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(value)));
}
