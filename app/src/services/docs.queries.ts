import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import type { DocItem } from "~/types/notes";
import type { NoteDoc } from "~/lib/note-content/types";
import {
  noteText,
  readNoteContent,
} from "~/server/notes/note-store";
import { resolveNoteReferences } from "~/server/notes/note-links";

export type DocDetail = {
  id: string;
  title: string;
  /** Canonical blocks (converted from the legacy columns when not yet migrated). */
  content: NoteDoc;
  contentVersion: number;
  markdown?: string | null;
  html?: string | null;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  originalSource?: string | null;
  originalContentId?: string | null;
  createdAt: string;
  updatedAt: string;
  share?: {
    id: string;
    slug: string;
    shareUrl: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type DocPreview = {
  id: string;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  previewText: string;
};

export type PathNoteCard = {
  id: string;
  title: string;
  path?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PathPageData = {
  path: string;
  totalCount: number;
  notes: PathNoteCard[];
  childPaths: { path: string; count: number }[];
};

export type RelatedPathNotesData = {
  path: string;
  notes: PathNoteCard[];
};

export type PathDiscoveryItem = {
  path: string;
  count: number;
  lastViewedAt?: string;
};

export type PathDiscoveryData = {
  recentlyViewed: PathDiscoveryItem[];
  highCount: PathDiscoveryItem[];
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
        include: { share: true },
      })
    : await prisma.doc.findUnique({ where: { id: docId }, include: { share: true } });
  if (!resolvedDoc) throw new Error("Not found");
  return {
    id: resolvedDoc.id,
    title: resolvedDoc.title,
    content: await resolveNoteReferences(readNoteContent(resolvedDoc)),
    contentVersion: resolvedDoc.contentVersion,
    markdown: resolvedDoc.markdown,
    html: resolvedDoc.html,
    path: resolvedDoc.path,
    meta: resolvedDoc.meta as Record<string, unknown> | null,
    originalSource: resolvedDoc.originalSource,
    originalContentId: resolvedDoc.originalContentId,
    createdAt: resolvedDoc.createdAt.toISOString(),
    updatedAt: resolvedDoc.updatedAt.toISOString(),
    share: resolvedDoc.share
      ? {
          id: resolvedDoc.share.id,
          slug: resolvedDoc.share.slug,
          shareUrl: resolvedDoc.share.shareUrl,
          createdAt: resolvedDoc.share.createdAt.toISOString(),
          updatedAt: resolvedDoc.share.updatedAt.toISOString(),
        }
      : null,
  };
}, "docs-get");

export const fetchDocs = query(
  async (input?: { take?: number }): Promise<DocItem[]> => {
    "use server";
    const startedAt = Date.now();
    const take = Math.max(1, Math.min(8000, input?.take ?? 8000));
    const items = await prisma.doc.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        path: true,
        meta: true,
        share: {
          select: {
            slug: true,
            shareUrl: true,
          },
        },
      },
      take,
    });
    console.log("[services] fetchDocs", {
      take,
      count: items.length,
      ms: Date.now() - startedAt,
    });
    return items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      meta: item.meta as DocItem["meta"],
      share: item.share
        ? {
            slug: item.share.slug,
            shareUrl: item.share.shareUrl,
          }
        : null,
    }));
  },
  "docs-list"
);

const PREVIEW_INPUT_LIMIT = 20000;
const DOC_PREVIEW_BATCH_SIZE = 120;

const limitPreviewInput = (value: string) =>
  value.length > PREVIEW_INPUT_LIMIT ? value.slice(0, PREVIEW_INPUT_LIMIT) : value;

const normalizePreviewText = (value: string) =>
  limitPreviewInput(value).replace(/\s+/g, " ").trim();

const stripFencedCodeBlocks = (value: string) => {
  if (!value.includes("```")) return value;
  const parts = value.split("```");
  return parts.filter((_part, index) => index % 2 === 0).join(" ");
};

export const buildDocPreviewText = (
  markdown?: string | null,
  html?: string | null,
  maxLen = 240
) => {
  const markdownText = limitPreviewInput(String(markdown || ""));
  const htmlText = limitPreviewInput(String(html || ""));
  if (htmlText) {
    const plain = normalizePreviewText(
      htmlText
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
    );
    return plain.length > 0 ? plain.slice(0, maxLen) : "No preview available.";
  }

  const md = normalizePreviewText(
    stripFencedCodeBlocks(markdownText)
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/[*_~>-]/g, " ")
  );
  if (md.length > 0) return md.slice(0, maxLen);
  return "No preview available.";
};

/** Preview text from a note's blocks. */
export const buildNotePreviewText = (
  row: { content?: unknown; html?: string | null; markdown?: string | null },
  maxLen = 240,
) => {
  const plain = normalizePreviewText(limitPreviewInput(noteText(row)));
  return plain.length > 0 ? plain.slice(0, maxLen) : "No preview available.";
};

export const fetchDocPreviews = query(
  async (ids: string[]): Promise<DocPreview[]> => {
    "use server";
    const startedAt = Date.now();
    const unique = Array.from(
      new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))
    ).slice(0, DOC_PREVIEW_BATCH_SIZE);
    if (unique.length === 0) return [];

    const rows = await prisma.doc.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        content: true,
          html: true,
          markdown: true,
        path: true,
        meta: true,
      },
    });

    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered = unique
      .map((id) => byId.get(id))
      .filter(
        (row): row is NonNullable<typeof row> => row !== undefined
      )
      .map((row) => ({
        id: row.id,
        path: row.path,
        meta: row.meta as Record<string, unknown> | null,
        previewText: buildNotePreviewText(row),
      }));

    console.log("[services] fetchDocPreviews", {
      requested: ids.length,
      unique: unique.length,
      returned: ordered.length,
      ms: Date.now() - startedAt,
    });
    return ordered;
  },
  "docs-preview-bulk"
);

// Hydrate the combined result while keeping each inner query cached per chunk.
const fetchDocPreviewsBatchedQuery = query(
  async (ids: string[]): Promise<DocPreview[]> => {
    const requests: Promise<DocPreview[]>[] = [];
    for (let i = 0; i < ids.length; i += DOC_PREVIEW_BATCH_SIZE) {
      requests.push(fetchDocPreviews(ids.slice(i, i + DOC_PREVIEW_BATCH_SIZE)));
    }
    return Promise.all(requests).then((results) => results.flat());
  },
  "docs-preview-batched",
);

export const fetchDocPreviewsBatched = (
  ids: string[],
): Promise<DocPreview[]> => {
  const unique = Array.from(
    new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))
  );
  return fetchDocPreviewsBatchedQuery(unique);
};

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

export type PathStat = {
  path: string;
  count: number;
  lastUpdatedAt: string | null;
};

// Per-path note counts plus the newest update, so the path browser can show
// recency rollups for every subtree without loading the notes themselves.
export const fetchPathStats = query(
  async (): Promise<PathStat[]> => {
    "use server";
    const groups = await prisma.doc.groupBy({
      by: ["path"],
      _count: { _all: true },
      _max: { updatedAt: true },
      where: { path: { not: null } },
    });
    const items = groups
      .filter((g) => typeof g.path === "string" && g.path.trim().length > 0)
      .map((g) => ({
        path: g.path as string,
        count: g._count._all,
        lastUpdatedAt: g._max.updatedAt?.toISOString() ?? null,
      }));
    console.log(`[services] fetchPathStats: count=${items.length}`);
    return items;
  },
  "docs-path-stats"
);

export const fetchPathPageData = query(
  async (
    input: { path: string; take?: number } | undefined
  ): Promise<PathPageData> => {
    "use server";
    const rawPath = String(input?.path || "").trim();
    const path = rawPath
      .split(".")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
      .join(".");
    if (!path) {
      return { path: "", totalCount: 0, notes: [], childPaths: [] };
    }

    const take = Math.max(1, Math.min(8000, input?.take ?? 8000));
    const treeWhere = {
      OR: [{ path }, { path: { startsWith: `${path}.` } }],
    };

    const [totalCount, rows, descendantPathGroups] = await Promise.all([
      prisma.doc.count({ where: treeWhere }),
      prisma.doc.findMany({
        where: treeWhere,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          path: true,
          createdAt: true,
          updatedAt: true,
        },
        take,
      }),
      prisma.doc.groupBy({
        by: ["path"],
        _count: { _all: true },
        where: { path: { startsWith: `${path}.` } },
      }),
    ]);

    const childCounts = new Map<string, number>();
    for (const row of descendantPathGroups) {
      const rowPath = String(row.path || "");
      if (!rowPath.startsWith(`${path}.`)) continue;
      const remainder = rowPath.slice(path.length + 1);
      const nextSeg = remainder.split(".")[0] || "";
      if (!nextSeg) continue;
      const child = `${path}.${nextSeg}`;
      childCounts.set(child, (childCounts.get(child) || 0) + row._count._all);
    }

    const childPaths = Array.from(childCounts.entries())
      .map(([childPath, count]) => ({ path: childPath, count }))
      .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
      .slice(0, 24);

    return {
      path,
      totalCount,
      notes: rows.map((row) => ({
        id: row.id,
        title: row.title,
        path: row.path,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      childPaths,
    };
  },
  "docs-path-page-data"
);

export const fetchRelatedNotesByPath = query(
  async (
    input:
      | {
          path: string;
          currentDocId?: string;
          take?: number;
        }
      | undefined
  ): Promise<RelatedPathNotesData> => {
    "use server";
    const path = String(input?.path || "").trim();
    if (!path) return { path: "", notes: [] };
    const take = Math.max(1, Math.min(8000, input?.take ?? 8000));
    const currentDocId = String(input?.currentDocId || "");
    const rows = await prisma.doc.findMany({
      where: {
        path,
        ...(currentDocId ? { id: { not: currentDocId } } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        path: true,
        createdAt: true,
        updatedAt: true,
      },
      take,
    });
    return {
      path,
      notes: rows.map((row) => ({
        id: row.id,
        title: row.title,
        path: row.path,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  },
  "docs-related-notes-by-path"
);

export const fetchPathDiscovery = query(
  async (): Promise<PathDiscoveryData> => {
    "use server";

    const groupedPaths = await prisma.doc.groupBy({
      by: ["path"],
      _count: { _all: true },
      where: {
        path: {
          not: null,
        },
      },
    });

    const highCount: PathDiscoveryItem[] = groupedPaths
      .filter((row) => typeof row.path === "string" && row.path.trim().length > 0)
      .map((row) => ({
        path: row.path as string,
        count: row._count._all,
      }))
      .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
      .slice(0, 5);

    const recentEvents = await prisma.actionEvent.findMany({
      where: {
        eventType: "doc.view",
        relatedDocId: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        relatedDoc: {
          select: { path: true },
        },
      },
      take: 500,
    });

    const recentByPath = new Map<string, { count: number; lastViewedAt: string }>();
    for (const event of recentEvents) {
      const path = String(event.relatedDoc?.path || "").trim();
      if (!path) continue;
      if (!recentByPath.has(path)) {
        recentByPath.set(path, {
          count: 0,
          lastViewedAt: event.createdAt.toISOString(),
        });
      }
      const current = recentByPath.get(path);
      if (!current) continue;
      current.count += 1;
    }

    const recentlyViewed = Array.from(recentByPath.entries())
      .map(([path, value]) => ({
        path,
        count: value.count,
        lastViewedAt: value.lastViewedAt,
      }))
      .slice(0, 5);

    return { recentlyViewed, highCount };
  },
  "docs-path-discovery"
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

/** Cheap check for edits made elsewhere (another tab, ChatGPT). */
export const fetchDocContentVersion = query(async (id: string) => {
  "use server";
  const row = await prisma.doc.findUnique({
    where: { id },
    select: { contentVersion: true },
  });
  return row?.contentVersion ?? null;
}, "doc-content-version");
