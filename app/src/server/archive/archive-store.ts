import type { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import { normalizeArchivedPageUrl } from "~/server/lib/archive/url";
import { publishAppChange } from "~/server/note-events";
import { getArchiveMetaDescription } from "~/services/archive/archive-canvas";

// Web archive reads and the one write agents share with the archive drawer
// (adding a note to a saved page). Snapshot HTML stays on disk; agents get
// the stored text snippets instead.

export type ArchivedPageSummary = {
  id: string;
  title: string;
  url: string;
  hostname: string | null;
  group: string | null;
  description: string | null;
  lastCapturedAt: string | null;
  notesCount: number;
  updatedAt: string;
};

const summarySelect = {
  id: true,
  title: true,
  originalUrl: true,
  siteHostname: true,
  groupName: true,
  meta: true,
  lastCapturedAt: true,
  updatedAt: true,
  _count: { select: { notes: true } },
} satisfies Prisma.ArchivedPageSelect;

type SummaryRow = Prisma.ArchivedPageGetPayload<{
  select: typeof summarySelect;
}>;

const toSummary = (row: SummaryRow): ArchivedPageSummary => ({
  id: row.id,
  title: row.title,
  url: row.originalUrl,
  hostname: row.siteHostname,
  group: row.groupName,
  description: getArchiveMetaDescription(
    row.meta as Record<string, unknown> | null,
  ),
  lastCapturedAt: row.lastCapturedAt?.toISOString() ?? null,
  notesCount: row._count.notes,
  updatedAt: row.updatedAt.toISOString(),
});

export type ArchiveSearchInput = {
  /** Words in the title, url, or the page's notes. */
  text?: string;
  group?: string;
  hostname?: string;
  capturedAfter?: Date;
  limit?: number;
};

export async function searchArchivedPages(
  input: ArchiveSearchInput,
): Promise<ArchivedPageSummary[]> {
  const text = input.text?.trim();
  const where: Prisma.ArchivedPageWhereInput = {
    ...(input.group?.trim()
      ? { groupName: { equals: input.group.trim(), mode: "insensitive" } }
      : {}),
    ...(input.hostname?.trim()
      ? {
          siteHostname: {
            contains: input.hostname.trim(),
            mode: "insensitive",
          },
        }
      : {}),
    ...(input.capturedAfter
      ? { lastCapturedAt: { gte: input.capturedAfter } }
      : {}),
    ...(text
      ? {
          OR: [
            { title: { contains: text, mode: "insensitive" } },
            { originalUrl: { contains: text, mode: "insensitive" } },
            {
              notes: {
                some: { noteText: { contains: text, mode: "insensitive" } },
              },
            },
          ],
        }
      : {}),
  };
  const rows = await prisma.archivedPage.findMany({
    where,
    orderBy: [
      { lastCapturedAt: { sort: "desc", nulls: "last" } },
      { updatedAt: "desc" },
    ],
    select: summarySelect,
    take: Math.max(1, Math.min(100, input.limit ?? 20)),
  });
  return rows.map(toSummary);
}

export type ArchivedPageWithNotes = ArchivedPageSummary & {
  notes: { id: string; text: string; imageUrls: string[]; createdAt: string }[];
  snapshots: {
    id: string;
    capturedAt: string;
    title: string | null;
    textSnippet: string | null;
  }[];
};

export async function getArchivedPage(
  id: string,
): Promise<ArchivedPageWithNotes | null> {
  const row = await prisma.archivedPage.findUnique({
    where: { id },
    select: {
      ...summarySelect,
      notes: {
        orderBy: { createdAt: "desc" },
        select: { id: true, noteText: true, imageUrls: true, createdAt: true },
      },
      snapshots: {
        orderBy: { capturedAt: "desc" },
        take: 5,
        select: { id: true, capturedAt: true, title: true, textSnippet: true },
      },
    },
  });
  if (!row) return null;
  return {
    ...toSummary(row),
    notes: row.notes.map((n) => ({
      id: n.id,
      text: n.noteText,
      imageUrls: n.imageUrls,
      createdAt: n.createdAt.toISOString(),
    })),
    snapshots: row.snapshots.map((s) => ({
      ...s,
      capturedAt: s.capturedAt.toISOString(),
    })),
  };
}

/** The saved page for a url (matched the way the extension matches it). */
export async function findArchivedPageByUrl(
  url: string,
): Promise<ArchivedPageSummary | null> {
  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeArchivedPageUrl(url.trim()).normalizedUrl;
  } catch {
    return null;
  }
  const row = await prisma.archivedPage.findUnique({
    where: { normalizedUrl },
    select: summarySelect,
  });
  return row ? toSummary(row) : null;
}

export class ArchiveInputError extends Error {}

export async function addArchivedPageNote(input: {
  pageId: string;
  noteText?: string;
  imageUrl?: string;
}) {
  const noteText = input.noteText?.trim() ?? "";
  const imageUrls = input.imageUrl?.trim() ? [input.imageUrl.trim()] : [];
  if (!noteText && imageUrls.length === 0)
    throw new ArchiveInputError("Add note text or an image URL");
  const page = await prisma.archivedPage.findUnique({
    where: { id: input.pageId },
    select: { id: true },
  });
  if (!page) throw new ArchiveInputError("Archived page not found");
  const created = await prisma.archivedPageNote.create({
    data: { archivedPageId: input.pageId, noteText, imageUrls },
    select: { id: true, archivedPageId: true, createdAt: true },
  });
  publishAppChange("archive", [created.archivedPageId]);
  return {
    id: created.id,
    pageId: created.archivedPageId,
    createdAt: created.createdAt.toISOString(),
  };
}
