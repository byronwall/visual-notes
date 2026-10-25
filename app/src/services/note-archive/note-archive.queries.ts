import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import {
  ARCHIVE_RETENTION_DAYS,
  deletesAt,
  resolveArchiveRedirect,
} from "~/server/notes/archive-window";

export type ArchivedNote = {
  id: string;
  title: string;
  path: string | null;
  reason: string | null;
  archivedAt: string;
  deletesAt: string;
  into: { id: string; title: string } | null;
};

export type ArchivedNotesData = {
  retentionDays: number;
  notes: ArchivedNote[];
};

/** The cleanup archive, soonest deletion first. */
export const fetchArchivedNotes = query(
  async (): Promise<ArchivedNotesData> => {
    "use server";
    const rows = await prisma.doc.findMany({
      where: { archivedAt: { not: null } },
      orderBy: { archivedAt: "asc" },
      take: 500,
      select: {
        id: true,
        title: true,
        path: true,
        archiveReason: true,
        archivedAt: true,
        archivedInto: { select: { id: true, title: true } },
      },
    });
    return {
      retentionDays: ARCHIVE_RETENTION_DAYS,
      notes: rows.map((row) => ({
        id: row.id,
        title: row.title,
        path: row.path,
        reason: row.archiveReason,
        archivedAt: row.archivedAt!.toISOString(),
        deletesAt: deletesAt(row.archivedAt!).toISOString(),
        into: row.archivedInto,
      })),
    };
  },
  "note-archive-list",
);

export type NoteTombstone = {
  id: string;
  title: string;
  deletedAt: string;
  redirect: { id: string; title: string } | null;
};

/** What is left of a note the archive deleted, for old links. */
export const fetchNoteTombstone = query(
  async (id: string): Promise<NoteTombstone | null> => {
    "use server";
    const tombstone = await prisma.docTombstone.findUnique({
      where: { id: String(id || "") },
    });
    if (!tombstone) return null;
    return {
      id: tombstone.id,
      title: tombstone.title,
      deletedAt: tombstone.deletedAt.toISOString(),
      redirect: await resolveArchiveRedirect(tombstone.id),
    };
  },
  "note-tombstone",
);
