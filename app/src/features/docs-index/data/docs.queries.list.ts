import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import type {
  DocListItem,
  DocsFilters,
  DocsSummary,
  MetaRecord,
  SortMode,
} from "./docs.types";
import { computeFacets } from "./docs.facets";
import { docsWhereFromFilters } from "./docs.queries.shared";

export const fetchDocs = query(
  async (
    q: DocsFilters & {
      sortMode?: SortMode;
      take?: number;
      /** Rows to skip, for paging; the index loads 100 at a time. */
      skip?: number;
    },
  ): Promise<DocListItem[]> => {
    "use server";
    const startedAt = Date.now();
    const where = docsWhereFromFilters(q);
    const take = Math.max(1, Math.min(8000, q.take ?? 8000));
    const sortMode = q.sortMode ?? "recent_activity";
    // The id tiebreak keeps pages stable when timestamps tie.
    const primary =
      sortMode === "most_viewed_30d"
        ? [
            { activitySnapshot: { views30d: "desc" as const } },
            { updatedAt: "desc" as const },
          ]
        : sortMode === "most_edited_30d"
          ? [
              { activitySnapshot: { edits30d: "desc" as const } },
              { updatedAt: "desc" as const },
            ]
          : sortMode === "recent_activity"
            ? [
                { activitySnapshot: { lastInteractedAt: "desc" as const } },
                { updatedAt: "desc" as const },
              ]
            : [{ updatedAt: "desc" as const }];
    const orderBy = [...primary, { id: "desc" as const }];
    const items = await prisma.doc.findMany({
      orderBy,
      where,
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
        collection: {
          select: { id: true, name: true, icon: true, deletedAt: true },
        },
      },
      take,
      skip: Math.max(0, q.skip ?? 0),
    });
    console.log("[docs-index] fetchDocs", {
      ms: Date.now() - startedAt,
      count: items.length,
      take,
      skip: q.skip ?? 0,
      sortMode,
      hasFilters: Object.keys(where).length > 1,
    });
    return items.map((item) => ({
      id: item.id,
      title: item.title,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      path: item.path,
      meta: item.meta as DocListItem["meta"],
      share: item.share
        ? {
            slug: item.share.slug,
            shareUrl: item.share.shareUrl,
          }
        : null,
      collection:
        item.collection && !item.collection.deletedAt
          ? {
              id: item.collection.id,
              name: item.collection.name,
              icon: item.collection.icon,
            }
          : null,
    }));
  },
  "docs-index-list",
);

/**
 * Total matches, counts per "last updated" heading, and facet counts, so the
 * index labels everything with real totals while it pages rows in 100 at a
 * time. Reads a few short fields per note, never a body, which stays small at
 * production scale. Filters without a facet narrow the query; the rest run in
 * `computeFacets`, because each facet ignores its own selection.
 */
export const fetchDocsSummary = query(
  async (q: DocsFilters): Promise<DocsSummary> => {
    "use server";
    const startedAt = Date.now();
    const [rows, collections] = await Promise.all([
      prisma.doc.findMany({
        where: docsWhereFromFilters({
          originalContentId: q.originalContentId,
          createdFrom: q.createdFrom,
          createdTo: q.createdTo,
          updatedFrom: q.updatedWithinDays ? undefined : q.updatedFrom,
          updatedTo: q.updatedWithinDays ? undefined : q.updatedTo,
          collectionRows: "all",
        }),
        select: {
          path: true,
          originalSource: true,
          collectionId: true,
          collection: { select: { showRowsInRecent: true } },
          updatedAt: true,
          meta: true,
          activitySnapshot: { select: { activityClass: true } },
        },
      }),
      prisma.collection.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, icon: true },
      }),
    ]);
    const nowMs = Date.now();
    const summary = computeFacets(
      rows.map((row) => ({
        path: row.path,
        source: row.originalSource,
        collectionId: row.collectionId,
        collectionOptedIn: !!row.collection?.showRowsInRecent,
        updatedAtMs: row.updatedAt.getTime(),
        activityClass: row.activitySnapshot?.activityClass ?? null,
        meta: row.meta as MetaRecord | null,
      })),
      q,
      collections,
      nowMs,
    );
    console.log("[docs-index] fetchDocsSummary", {
      ms: Date.now() - startedAt,
      scanned: rows.length,
      total: summary.total,
    });
    return { ...summary, nowMs };
  },
  "docs-index-summary",
);
