// Plain-text view of row properties for readers outside the collections UI
// (the ChatGPT connector, exports).
import { prisma } from "~/server/db";
import type { RowProperties } from "~/lib/collections/types";
import { formatValueText, readValue } from "~/lib/collections/values";
import {
  asObject,
  mapProperty,
  mapRow,
  ROW_SELECT,
} from "./collections.server";

export type CollectionText = {
  collectionId: string;
  collection: string;
  properties: Record<string, string>;
};

/** Collection name and non-empty property values (as text) per note id. */
export async function collectionTextForNotes(
  docIds: string[],
): Promise<Record<string, CollectionText>> {
  if (!docIds.length) return {};
  const docs = await prisma.doc.findMany({
    where: { id: { in: docIds }, collectionId: { not: null } },
    select: { ...ROW_SELECT, collectionId: true },
  });
  const collectionIds = [...new Set(docs.map((d) => d.collectionId!))];
  if (!collectionIds.length) return {};
  const collections = await prisma.collection.findMany({
    where: { id: { in: collectionIds }, deletedAt: null },
    include: {
      properties: { where: { deletedAt: null }, orderBy: { position: "asc" } },
    },
  });
  const byId = new Map(collections.map((c) => [c.id, c]));
  const out: Record<string, CollectionText> = {};
  for (const doc of docs) {
    const collection = byId.get(doc.collectionId!);
    if (!collection) continue;
    const row = mapRow({
      ...doc,
      properties: asObject<RowProperties>(doc.properties),
    });
    const properties: Record<string, string> = {};
    for (const p of collection.properties.map(mapProperty)) {
      const text = formatValueText(p, readValue(row, p));
      if (text) properties[p.name] = text;
    }
    out[doc.id] = { collectionId: collection.id, collection: collection.name, properties };
  }
  return out;
}
