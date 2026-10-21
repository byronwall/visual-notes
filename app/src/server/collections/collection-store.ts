// Collection schema writes shared by the collection page's router actions
// and the MCP connector.
import type { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import {
  OPTION_COLORS,
  type CollectionProperty,
  type PropertyConfig,
  type PropertyKind,
  type ViewConfig,
  type ViewType,
} from "~/lib/collections/types";
import {
  mapBetweenCollections,
  mapMetaToProperties,
  resolveNewOptions,
  type MappedValues,
} from "~/lib/collections/mapping";
import type { CollectionRow, RowProperties } from "~/lib/collections/types";
import {
  ROW_SELECT,
  asObject,
  attachNotes,
  defaultConfigFor,
  loadLiveProperties,
  mapProperty,
  mapRow,
  mapView,
  newOptionId,
  requireCollection,
} from "~/services/collections/collections.server";

/** A collection with Status and Tags properties and one table view. */
export async function createCollectionRecord(input: {
  name: string;
  description?: string;
  icon?: string;
}) {
  const created = await prisma.$transaction(async (tx) => {
    const collection = await tx.collection.create({
      data: { name: input.name, description: input.description, icon: input.icon },
    });
    await tx.collectionProperty.createMany({
      data: [
        {
          collectionId: collection.id,
          name: "Status",
          kind: "status",
          position: 0,
          config: defaultConfigFor("status") as Prisma.InputJsonValue,
        },
        {
          collectionId: collection.id,
          name: "Tags",
          kind: "multi_select",
          position: 1,
          config: defaultConfigFor("multi_select") as Prisma.InputJsonValue,
        },
      ],
    });
    await tx.collectionView.create({
      data: { collectionId: collection.id, name: "Table", type: "table", position: 0 },
    });
    return collection;
  });
  console.info("[collections] created %s", created.id);
  return created;
}

/** Appends a property; select-like kinds start with their default options. */
export async function createPropertyRecord(input: {
  collectionId: string;
  name: string;
  kind: PropertyKind;
  config?: PropertyConfig;
}): Promise<CollectionProperty> {
  await requireCollection(input.collectionId);
  const last = await prisma.collectionProperty.findFirst({
    where: { collectionId: input.collectionId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const created = await prisma.collectionProperty.create({
    data: {
      collectionId: input.collectionId,
      name: input.name,
      kind: input.kind,
      position: (last?.position ?? -1) + 1,
      config: (input.config ?? defaultConfigFor(input.kind)) as Prisma.InputJsonValue,
    },
  });
  return mapProperty(created);
}

/** Adds any missing option names to select-like properties; returns the fresh schema. */
export async function ensureOptions(
  tx: Prisma.TransactionClient,
  properties: CollectionProperty[],
  newOptions: Record<string, string[]>,
): Promise<CollectionProperty[]> {
  const next = properties.map((p) => ({
    ...p,
    config: { ...p.config, options: [...(p.config.options ?? [])] },
  }));
  for (const [propertyId, names] of Object.entries(newOptions)) {
    const property = next.find((p) => p.id === propertyId);
    if (!property || !names.length) continue;
    const options = property.config.options!;
    for (const name of names) {
      if (options.some((o) => o.name.toLowerCase() === name.toLowerCase())) continue;
      options.push({
        id: newOptionId(),
        name,
        color: OPTION_COLORS[(options.length + 1) % OPTION_COLORS.length]!,
        ...(property.kind === "status" ? { group: "todo" as const } : {}),
      });
    }
    await tx.collectionProperty.update({
      where: { id: property.id },
      data: { config: property.config as Prisma.InputJsonValue },
    });
  }
  return next;
}

/** A page view (no host) goes last; a view hosted by a note is that note's embed. */
export async function createViewRecord(input: {
  collectionId: string;
  name: string;
  type: ViewType;
  config?: ViewConfig;
  hostDocId?: string | null;
}) {
  await requireCollection(input.collectionId);
  const last = await prisma.collectionView.findFirst({
    where: { collectionId: input.collectionId, hostDocId: null },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const created = await prisma.collectionView.create({
    data: {
      collectionId: input.collectionId,
      name: input.name,
      type: input.type,
      config: (input.config ?? {}) as Prisma.InputJsonValue,
      hostDocId: input.hostDocId ?? null,
      position: input.hostDocId ? 0 : (last?.position ?? -1) + 1,
    },
  });
  return mapView(created);
}

const mergeAll = (mapped: MappedValues[]) => {
  const newOptions: Record<string, string[]> = {};
  for (const m of mapped)
    for (const [pid, names] of Object.entries(m.newOptions))
      newOptions[pid] = [...(newOptions[pid] ?? []), ...names];
  return newOptions;
};

/**
 * Adds existing notes to a collection. Values already stored for this
 * collection come back; meta keys matching property names fill the rest.
 * Notes in another collection are moved (their values carry over by name).
 */
export async function addNotes(collectionId: string, docIds: string[]) {
  const input = { collectionId, docIds };
  await requireCollection(input.collectionId);
  const properties = await loadLiveProperties(input.collectionId);
  const docs = await prisma.doc.findMany({
    where: { id: { in: input.docIds } },
    select: { id: true, meta: true, properties: true, collectionId: true },
  });
  const sourceIds = [
    ...new Set(
      docs
        .map((d) => d.collectionId)
        .filter((c): c is string => Boolean(c) && c !== input.collectionId),
    ),
  ];
  const sourceSchemas = new Map<string, CollectionProperty[]>();
  for (const sid of sourceIds)
    sourceSchemas.set(sid, await loadLiveProperties(sid));

  const plans = docs.map((doc) => {
    const stored = asObject<RowProperties>(doc.properties);
    const fromMeta = mapMetaToProperties(
      asObject<Record<string, unknown>>(doc.meta),
      properties,
    );
    const fromOther =
      doc.collectionId && sourceSchemas.has(doc.collectionId)
        ? mapBetweenCollections(
            sourceSchemas.get(doc.collectionId)!,
            properties,
            stored,
          )
        : null;
    return { doc, stored, fromMeta, fromOther };
  });

  const rows = await prisma.$transaction(async (tx) => {
    const schema = await ensureOptions(
      tx,
      properties,
      mergeAll(
        plans.flatMap((p) => [
          p.fromMeta,
          ...(p.fromOther ? [p.fromOther] : []),
        ]),
      ),
    );
    for (const plan of plans) {
      const ownKeys = new Set(schema.map((p) => p.id));
      // Precedence: values previously stored for this collection, then values
      // carried from the old collection, then meta.
      const kept = Object.fromEntries(
        Object.entries(plan.stored).filter(([k]) => ownKeys.has(k)),
      );
      const values = {
        ...resolveNewOptions(plan.fromMeta, schema),
        ...(plan.fromOther ? resolveNewOptions(plan.fromOther, schema) : {}),
        ...kept,
      };
      await tx.doc.update({
        where: { id: plan.doc.id },
        data: { properties: values as Prisma.InputJsonValue },
      });
    }
    return schema;
  });
  await attachNotes(input.collectionId, input.docIds);
  const updated = await prisma.doc.findMany({
    where: { id: { in: input.docIds } },
    select: ROW_SELECT,
  });
  console.info(
    "[collections] added %d notes to %s",
    updated.length,
    input.collectionId,
  );
  return { rows: updated.map(mapRow) as CollectionRow[], properties: rows };
}

