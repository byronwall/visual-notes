// Bringing existing notes into collections and moving them between them.
import { action, json, query } from "@solidjs/router";
import { z } from "zod";
import { prisma } from "~/server/db";
import { mapBetweenCollections } from "~/lib/collections/mapping";
import {
  type PropertyConfig,
  type RowProperties,
} from "~/lib/collections/types";
import {
  asObject,
  loadLiveProperties,
  requireCollection,
} from "./collections.server";
import { fetchCollections } from "./collections.queries";
import { addNotes } from "~/server/collections/collection-store";

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
        archivedAt: null,
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
