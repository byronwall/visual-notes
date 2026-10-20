import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import type {
  CollectionBundle,
  CollectionSummary,
} from "~/lib/collections/types";
import {
  ROW_SELECT,
  localToday,
  mapCollection,
  mapProperty,
  mapRow,
  mapView,
} from "./collections.server";
import { summarizeCollectionNotes, type NoteSummary } from "./note-summary";

export type { NoteSummary };

export type CollectionListItem = CollectionSummary & {
  rowCount: number;
  updatedAt: string;
};

export const fetchCollections = query(
  async (): Promise<CollectionListItem[]> => {
    "use server";
    const items = await prisma.collection.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { rows: true } } },
    });
    return items.map((c) => ({
      ...mapCollection(c),
      rowCount: c._count.rows,
      updatedAt: c.updatedAt.toISOString(),
    }));
  },
  "collections-list",
);

async function loadBundle(
  collectionId: string,
): Promise<CollectionBundle | null> {
  const startedAt = Date.now();
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, deletedAt: null },
    include: {
      properties: { where: { deletedAt: null }, orderBy: { position: "asc" } },
      views: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!collection) return null;
  const rows = await prisma.doc.findMany({
    where: { collectionId },
    select: ROW_SELECT,
    orderBy: [{ collectionRank: "asc" }, { createdAt: "asc" }],
  });
  console.debug(
    "[collections] bundle %s rows:%d %dms",
    collectionId,
    rows.length,
    Date.now() - startedAt,
  );
  return {
    collection: mapCollection(collection),
    properties: collection.properties.map(mapProperty),
    views: collection.views.map(mapView),
    rows: rows.map(mapRow),
    today: localToday(),
  };
}

/** Everything a collection page needs; page views exclude embedded ones. */
export const fetchCollectionBundle = query(
  async (collectionId: string): Promise<CollectionBundle | null> => {
    "use server";
    const bundle = await loadBundle(collectionId);
    if (!bundle) return null;
    return { ...bundle, views: bundle.views.filter((v) => !v.hostDocId) };
  },
  "collections-bundle",
);

/** Bundle for one view (used by note embeds). `views` holds only that view. */
export const fetchCollectionViewBundle = query(
  async (
    viewId: string,
  ): Promise<(CollectionBundle & { viewId: string }) | null> => {
    "use server";
    const view = await prisma.collectionView.findUnique({
      where: { id: viewId },
    });
    if (!view) return null;
    const bundle = await loadBundle(view.collectionId);
    if (!bundle) return null;
    return { ...bundle, views: [mapView(view)], viewId };
  },
  "collections-view-bundle",
);

export type DocCollectionInfo = {
  collection: CollectionSummary;
  properties: CollectionBundle["properties"];
  row: CollectionBundle["rows"][number];
} | null;

/** The collection a note belongs to, with its schema and the note's values. */
export const fetchDocCollection = query(
  async (docId: string): Promise<DocCollectionInfo> => {
    "use server";
    const doc = await prisma.doc.findUnique({
      where: { id: docId },
      select: { ...ROW_SELECT, collectionId: true },
    });
    if (!doc?.collectionId) return null;
    const collection = await prisma.collection.findFirst({
      where: { id: doc.collectionId, deletedAt: null },
      include: {
        properties: {
          where: { deletedAt: null },
          orderBy: { position: "asc" },
        },
      },
    });
    if (!collection) return null;
    return {
      collection: mapCollection(collection),
      properties: collection.properties.map(mapProperty),
      row: mapRow(doc),
    };
  },
  "collections-doc",
);

/** Cover image and preview text for each row, for gallery and board cards. */
export const fetchNoteSummaries = query(
  async (collectionId: string): Promise<Record<string, NoteSummary>> => {
    "use server";
    return summarizeCollectionNotes(collectionId);
  },
  "collections-note-summaries",
);
