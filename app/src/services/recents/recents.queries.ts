import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import { mergeRecentItems } from "./recents.merge";
import type { RecentItem } from "./recents.types";

const MAX_TAKE = 50;

/**
 * Recently created or edited notes, collections, and research topics, newest
 * first. Ordered by `updatedAt` only: opening something is not activity, so
 * viewing never moves it up the list. A collection's rows are notes, but they
 * appear only when that collection opted in with `showRowsInRecent`.
 */
export const fetchRecentItems = query(
  async (requested = 30): Promise<RecentItem[]> => {
    "use server";
    // Server functions take client input; never let it size the queries.
    const take = Math.min(
      Math.max(Math.floor(Number(requested) || 30), 1),
      MAX_TAKE,
    );
    const startedAt = Date.now();
    const [docs, collections, topics] = await Promise.all([
      prisma.doc.findMany({
        where: {
          archivedAt: null,
          // Deleting a collection clears `collectionId`, so its rows pass here.
          OR: [
            { collectionId: null },
            { collection: { showRowsInRecent: true } },
          ],
        },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          path: true,
          meta: true,
          updatedAt: true,
        },
        take,
      }),
      prisma.collection.findMany({
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, icon: true, updatedAt: true },
        take: 8,
      }),
      prisma.researchTopic.findMany({
        where: { archivedAt: null },
        orderBy: { updatedAt: "desc" },
        select: { slug: true, title: true, updatedAt: true },
        take: 8,
      }),
    ]);

    const items = mergeRecentItems(
      [
        ...docs.map(
          (d): RecentItem => ({
            kind: "note",
            id: d.id,
            title: d.title || "Untitled",
            href: `/docs/${d.id}`,
            at: d.updatedAt.toISOString(),
            path: d.path,
            meta: d.meta as RecentItem["meta"],
            updatedAt: d.updatedAt.toISOString(),
          }),
        ),
        ...collections.map(
          (c): RecentItem => ({
            kind: "collection",
            id: c.id,
            title: c.name || "Untitled collection",
            href: `/collections/${c.id}`,
            at: c.updatedAt.toISOString(),
            icon: c.icon,
          }),
        ),
        ...topics.map(
          (t): RecentItem => ({
            kind: "research",
            id: t.slug,
            title: t.title,
            href: `/research/${encodeURIComponent(t.slug)}`,
            at: t.updatedAt.toISOString(),
          }),
        ),
      ],
      take,
    );

    console.debug("[recents] fetchRecentItems", {
      ms: Date.now() - startedAt,
      count: items.length,
    });
    return items;
  },
  "sidebar-recent-items",
);
