import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import type { DocListItem, DocsSummary } from "./docs.types";
import { updatedBucket } from "../utils/grouping";
import {
  buildDocsWhere,
  toIsoDateEnd,
  toIsoDateStart,
} from "./docs.queries.shared";

export const fetchDocs = query(
  async (q: {
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
    collectionRows?: "hide" | "only";
    sortMode?:
      | "relevance"
      | "recent_activity"
      | "most_viewed_30d"
      | "most_edited_30d";
    take?: number;
    /** Rows to skip, for paging; the index loads 100 at a time. */
    skip?: number;
  }): Promise<DocListItem[]> => {
    "use server";
    const startedAt = Date.now();
    const where = buildDocsWhere({
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
      collectionRows: q.collectionRows,
    });
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
      hasFilters: Object.keys(where).length > 0,
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
  "docs-index-list"
);

type SummaryFilters = Omit<
  Parameters<typeof fetchDocs>[0],
  "take" | "skip" | "sortMode"
>;

/**
 * Total matches plus counts per "last updated" heading, so the index can
 * label headings with real totals while it pages rows in 100 at a time.
 * Reads one timestamp per note, which stays small at production scale.
 */
export const fetchDocsSummary = query(
  async (q: SummaryFilters): Promise<DocsSummary> => {
    "use server";
    const startedAt = Date.now();
    const where = buildDocsWhere({
      ...q,
      createdFrom: q.createdFrom ? toIsoDateStart(q.createdFrom) : undefined,
      createdTo: q.createdTo ? toIsoDateEnd(q.createdTo) : undefined,
      updatedFrom: q.updatedFrom ? toIsoDateStart(q.updatedFrom) : undefined,
      updatedTo: q.updatedTo ? toIsoDateEnd(q.updatedTo) : undefined,
    });
    const rows = await prisma.doc.findMany({
      where,
      select: { updatedAt: true },
    });
    const nowMs = Date.now();
    const bucketCounts: Record<string, number> = {};
    for (const row of rows) {
      const { key } = updatedBucket(row.updatedAt.getTime(), nowMs);
      bucketCounts[key] = (bucketCounts[key] ?? 0) + 1;
    }
    console.log("[docs-index] fetchDocsSummary", {
      ms: Date.now() - startedAt,
      total: rows.length,
    });
    return { total: rows.length, bucketCounts, nowMs };
  },
  "docs-index-summary",
);
