// Bringing existing notes into collections and moving them between them.
import { action, json, query } from "@solidjs/router";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "~/server/db";
import {
  mapBetweenCollections,
  mapMetaToProperties,
  resolveNewOptions,
  type MappedValues,
} from "~/lib/collections/mapping";
import {
  OPTION_COLORS,
  type CollectionProperty,
  type CollectionRow,
  type PropertyConfig,
  type RowProperties,
} from "~/lib/collections/types";
import {
  ROW_SELECT,
  asObject,
  attachNotes,
  loadLiveProperties,
  mapRow,
  newOptionId,
  requireCollection,
} from "./collections.server";
import { fetchCollections } from "./collections.queries";

const id = z.string().min(1).max(64);

export type NoteCandidate = {
  id: string;
  title: string;
  path: string | null;
  collectionName: string | null;
  updatedAt: string;
};

/** Notes that could join a collection: matching a title search and/or a path prefix. */
export const searchNotesForCollection = query(
  async (input: {
    collectionId: string;
    q?: string;
    path?: string;
  }): Promise<NoteCandidate[]> => {
    "use server";
    const { collectionId, q, path } = z
      .object({
        collectionId: id,
        q: z.string().max(200).optional(),
        path: z.string().max(512).optional(),
      })
      .parse(input);
    const docs = await prisma.doc.findMany({
      where: {
        OR: [{ collectionId: null }, { collectionId: { not: collectionId } }],
        ...(q?.trim()
          ? { title: { contains: q.trim(), mode: "insensitive" } }
          : {}),
        ...(path?.trim() ? { path: { startsWith: path.trim() } } : {}),
      },
      select: {
        id: true,
        title: true,
        path: true,
        updatedAt: true,
        collection: { select: { name: true, deletedAt: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return docs.map((d) => ({
      id: d.id,
      title: d.title,
      path: d.path,
      collectionName:
        d.collection && !d.collection.deletedAt ? d.collection.name : null,
      updatedAt: d.updatedAt.toISOString(),
    }));
  },
  "collections-note-candidates",
);

/** Adds any missing option names to select-like properties; returns the fresh schema. */
async function ensureOptions(
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
    if (!property) continue;
    const options = property.config.options!;
    for (const name of names) {
      if (options.some((o) => o.name.toLowerCase() === name.toLowerCase()))
        continue;
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
async function addNotes(collectionId: string, docIds: string[]) {
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

export const addNotesToCollection = action(
  async (payload: { collectionId: string; docIds: string[] }) => {
    "use server";
    const input = z
      .object({ collectionId: id, docIds: z.array(id).min(1).max(500) })
      .parse(payload);
    return json(await addNotes(input.collectionId, input.docIds), {
      revalidate: [fetchCollections.key],
    });
  },
  "collections-add-notes",
);

/** What moving a note to another collection would carry and drop. */
export const previewMoveNote = query(
  async (input: { docId: string; targetCollectionId: string }) => {
    "use server";
    const { docId, targetCollectionId } = z
      .object({ docId: id, targetCollectionId: id })
      .parse(input);
    const doc = await prisma.doc.findUnique({
      where: { id: docId },
      select: { properties: true, collectionId: true },
    });
    if (!doc?.collectionId)
      return { carried: [] as string[], dropped: [] as string[] };
    const [from, to] = await Promise.all([
      loadLiveProperties(doc.collectionId),
      loadLiveProperties(targetCollectionId),
    ]);
    const mapped = mapBetweenCollections(
      from,
      to,
      asObject<RowProperties>(doc.properties),
    );
    return { carried: mapped.carried, dropped: mapped.dropped };
  },
  "collections-preview-move",
);

/** Moves one note into another collection, carrying values that match by name. */
export const moveNoteToCollection = action(
  async (payload: { docId: string; targetCollectionId: string }) => {
    "use server";
    const input = z
      .object({ docId: id, targetCollectionId: id })
      .parse(payload);
    await requireCollection(input.targetCollectionId);
    const doc = await prisma.doc.findUnique({
      where: { id: input.docId },
      select: { collectionId: true },
    });
    if (doc?.collectionId !== input.targetCollectionId)
      await addNotes(input.targetCollectionId, [input.docId]);
    return json({ ok: true }, { revalidate: [fetchCollections.key] });
  },
  "collections-move-note",
);

/** Takes one note out of its collection; its values stay stored on the note. */
export const removeNoteFromCollection = action(async (docId: string) => {
  "use server";
  await prisma.doc.update({
    where: { id: id.parse(docId) },
    data: { collectionId: null },
  });
  return json({ ok: true }, { revalidate: [fetchCollections.key] });
}, "collections-remove-note");

export type { PropertyConfig };
