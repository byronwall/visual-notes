import { readFile } from "node:fs/promises";
import path from "node:path";
import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import {
  buildArchiveHtmlSnippet,
  resolveArchiveHtmlStorageDir,
} from "~/server/lib/archive/html-storage";
import { normalizeArchivedPageUrl } from "~/server/lib/archive/url";
import type {
  ArchiveListFilters,
  ArchivedPageDetail,
  ArchivedPageListItem,
  PageLookupResponse,
} from "./archive.types";

function getArchiveMetaPreviewImage(meta: Record<string, unknown> | null | undefined) {
  const twitter = typeof meta?.twitterImage === "string" ? meta.twitterImage : null;
  const og = typeof meta?.ogImage === "string" ? meta.ogImage : null;
  return twitter || og || null;
}

function getFirstNoteImage(
  notes:
    | Array<{
        imageUrls?: string[] | null;
      }>
    | null
    | undefined,
) {
  for (const note of notes || []) {
    const first = note.imageUrls?.find((value) => typeof value === "string" && value);
    if (first) return first;
  }
  return null;
}

function getArchivePreviewImage(args: {
  meta: Record<string, unknown> | null | undefined;
  notes?: Array<{ imageUrls?: string[] | null }> | null;
}) {
  return getArchiveMetaPreviewImage(args.meta) || getFirstNoteImage(args.notes);
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export const fetchArchivedPages = query(
  async (filters?: ArchiveListFilters): Promise<ArchivedPageListItem[]> => {
    "use server";
    const group = filters?.group?.trim();
    const hostname = filters?.hostname?.trim();
    const capturedFrom = parseDate(filters?.capturedFrom);
    const capturedTo = parseDate(filters?.capturedTo);

    const where: Record<string, unknown> = {};
    if (group) where.groupName = group;
    if (hostname) {
      where.siteHostname = { contains: hostname, mode: "insensitive" };
    }
    if (capturedFrom || capturedTo) {
      where.lastCapturedAt = {
        ...(capturedFrom ? { gte: capturedFrom } : {}),
        ...(capturedTo ? { lte: capturedTo } : {}),
      };
    }

    const rows = await prisma.archivedPage.findMany({
      where,
      orderBy: [{ lastCapturedAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        originalUrl: true,
        normalizedUrl: true,
        siteHostname: true,
        groupName: true,
        lastCapturedAt: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
        notes: {
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            imageUrls: true,
          },
        },
        _count: {
          select: {
            notes: true,
            snapshots: true,
          },
        },
      },
      take: 500,
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      originalUrl: row.originalUrl,
      normalizedUrl: row.normalizedUrl,
      siteHostname: row.siteHostname,
      groupName: row.groupName,
      lastCapturedAt: row.lastCapturedAt?.toISOString() ?? null,
      previewImageUrl: getArchivePreviewImage({
        meta: row.meta as Record<string, unknown> | null | undefined,
        notes: row.notes,
      }),
      notesCount: row._count.notes,
      snapshotsCount: row._count.snapshots,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  },
  "archive-items",
);

export const fetchArchivedPageDetail = query(
  async (id: string): Promise<ArchivedPageDetail> => {
    "use server";
    const pageId = String(id || "").trim();
    if (!pageId) throw new Error("Missing archive page id");

    const row = await prisma.archivedPage.findUnique({
      where: { id: pageId },
      include: {
        notes: {
          orderBy: { createdAt: "desc" },
        },
        snapshots: {
          orderBy: { capturedAt: "desc" },
          take: 20,
        },
      },
    });

    if (!row) throw new Error("Not found");

    let htmlSnippet = "No preview available.";
    const latestHtmlPath = row.snapshots.find((snapshot) => snapshot.htmlPath)?.htmlPath;
    if (latestHtmlPath) {
      try {
        const abs = path.resolve(
          resolveArchiveHtmlStorageDir(),
          path.basename(latestHtmlPath),
        );
        const html = await readFile(abs, "utf8");
        htmlSnippet = buildArchiveHtmlSnippet(html);
      } catch {
        htmlSnippet = "Stored HTML unavailable.";
      }
    }

    return {
      id: row.id,
      title: row.title,
      originalUrl: row.originalUrl,
      normalizedUrl: row.normalizedUrl,
      siteHostname: row.siteHostname,
      groupName: row.groupName,
      lastCapturedAt: row.lastCapturedAt?.toISOString() ?? null,
      previewImageUrl: getArchivePreviewImage({
        meta: row.meta as Record<string, unknown> | null | undefined,
        notes: row.notes,
      }),
      socialPreviewImageUrl: getArchiveMetaPreviewImage(
        row.meta as Record<string, unknown> | null | undefined,
      ),
      meta: (row.meta as Record<string, unknown> | null) ?? null,
      htmlSnippet,
      notes: row.notes.map((note) => ({
        id: note.id,
        noteText: note.noteText,
        imageUrls: note.imageUrls,
        sourceContext: (note.sourceContext as Record<string, unknown> | null) ?? null,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
        snapshotId: note.snapshotId,
      })),
      snapshots: row.snapshots.map((snapshot) => ({
        id: snapshot.id,
        captureMode: snapshot.captureMode,
        capturedAt: snapshot.capturedAt.toISOString(),
        title: snapshot.title,
        groupName: snapshot.groupName,
        htmlPath: snapshot.htmlPath,
        htmlHash: snapshot.htmlHash,
        textSnippet: snapshot.textSnippet,
        meta: (snapshot.meta as Record<string, unknown> | null) ?? null,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  },
  "archive-item-detail",
);

export const lookupArchivedPageByUrl = query(
  async (url: string): Promise<PageLookupResponse> => {
    "use server";
    const input = String(url || "").trim();
    if (!input) {
      return {
        exists: false,
        pageId: null,
        title: null,
        groupName: null,
        lastCapturedAt: null,
      };
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeArchivedPageUrl(input).normalizedUrl;
    } catch {
      return {
        exists: false,
        pageId: null,
        title: null,
        groupName: null,
        lastCapturedAt: null,
      };
    }

    const row = await prisma.archivedPage.findUnique({
      where: { normalizedUrl },
      select: {
        id: true,
        title: true,
        groupName: true,
        lastCapturedAt: true,
      },
    });

    return row
      ? {
          exists: true,
          pageId: row.id,
          title: row.title,
          groupName: row.groupName,
          lastCapturedAt: row.lastCapturedAt?.toISOString() ?? null,
        }
      : {
          exists: false,
          pageId: null,
          title: null,
          groupName: null,
          lastCapturedAt: null,
        };
  },
  "archive-lookup",
);

export const fetchArchivedPageGroups = query(
  async (): Promise<string[]> => {
    "use server";
    const rows = await prisma.archivedPage.groupBy({
      by: ["groupName"],
      where: { groupName: { not: null } },
      orderBy: { groupName: "asc" },
    });

    return rows
      .map((row) => row.groupName)
      .filter((value): value is string => Boolean(value));
  },
  "archive-groups",
);
