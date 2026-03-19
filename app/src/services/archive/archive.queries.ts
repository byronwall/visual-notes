import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import {
  buildArchiveHtmlSnippet,
  resolveArchiveHtmlStorageDir,
} from "~/server/lib/archive/html-storage";
import { normalizeArchivedPageUrl } from "~/server/lib/archive/url";
import {
  buildArchivePreferredImages,
  getArchiveCanvasDescription,
  getArchiveMetaFavicon,
  getArchiveMetaDescription,
  getArchiveMetaPreviewImage,
  getArchiveCanvasPosition,
  normalizeArchiveCanvasCardMode,
} from "./archive-canvas";
import type {
  ArchiveListFilters,
  ArchiveAdminSnapshotItem,
  ArchiveAdminSnapshotDetail,
  ArchivedPageCanvasItem,
  ArchivedPageCanvasOverviewGroup,
  ArchivedPageDetail,
  ArchivedPageGroupSummary,
  ArchivedPageListItem,
  PageLookupResponse,
} from "./archive.types";

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

async function readArchiveHtmlInfo(htmlPath: string | null | undefined) {
  if (!htmlPath) {
    return {
      htmlSnippet: "No preview available.",
      htmlSizeBytes: null,
    };
  }

  try {
    const abs = path.resolve(resolveArchiveHtmlStorageDir(), path.basename(htmlPath));
    const [html, stats] = await Promise.all([readFile(abs, "utf8"), stat(abs)]);
    return {
      htmlSnippet: buildArchiveHtmlSnippet(html),
      htmlSizeBytes: stats.size,
    };
  } catch {
    return {
      htmlSnippet: "Stored HTML unavailable.",
      htmlSizeBytes: null,
    };
  }
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

    return rows.map((row) => {
      const meta = row.meta as Record<string, unknown> | null | undefined;
      const previewImageUrls = buildArchivePreferredImages({
        meta,
        noteImageUrls: row.notes.map((note) => note.imageUrls ?? []),
        limit: 3,
      });

      return {
        id: row.id,
        title: row.title,
        originalUrl: row.originalUrl,
        normalizedUrl: row.normalizedUrl,
        siteHostname: row.siteHostname,
        groupName: row.groupName,
        lastCapturedAt: row.lastCapturedAt?.toISOString() ?? null,
        previewImageUrl: getArchivePreviewImage({
          meta,
          notes: row.notes,
        }),
        previewImageUrls,
        faviconUrl: getArchiveMetaFavicon(meta),
        description: getArchiveMetaDescription(meta),
        notesCount: row._count.notes,
        snapshotsCount: row._count.snapshots,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
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

    const latestHtmlPath = row.snapshots.find((snapshot) => snapshot.htmlPath)?.htmlPath;
    const meta = (row.meta as Record<string, unknown> | null) ?? null;
    const preferredImageUrls = buildArchivePreferredImages({
      meta,
      noteImageUrls: row.notes.map((note) => note.imageUrls ?? []),
      limit: 6,
    });
    const latestSnapshot = row.snapshots.find((snapshot) => snapshot.htmlPath) ?? row.snapshots[0];
    const htmlInfo = await readArchiveHtmlInfo(latestHtmlPath);

    const snapshots = await Promise.all(
      row.snapshots.map(async (snapshot) => {
        const htmlInfo = await readArchiveHtmlInfo(snapshot.htmlPath);
        return {
          id: snapshot.id,
          captureMode: snapshot.captureMode,
          capturedAt: snapshot.capturedAt.toISOString(),
          title: snapshot.title,
          groupName: snapshot.groupName,
          htmlPath: snapshot.htmlPath,
          htmlSizeBytes: htmlInfo.htmlSizeBytes,
          htmlHash: snapshot.htmlHash,
          textSnippet: snapshot.textSnippet,
          meta: (snapshot.meta as Record<string, unknown> | null) ?? null,
        };
      }),
    );

    return {
      id: row.id,
      title: row.title,
      originalUrl: row.originalUrl,
      normalizedUrl: row.normalizedUrl,
      siteHostname: row.siteHostname,
      groupName: row.groupName,
      lastCapturedAt: row.lastCapturedAt?.toISOString() ?? null,
      previewImageUrl: getArchivePreviewImage({
        meta,
        notes: row.notes,
      }),
      preferredImageUrls,
      socialPreviewImageUrl: getArchiveMetaPreviewImage(meta),
      faviconUrl: getArchiveMetaFavicon(meta),
      description: getArchiveMetaDescription(meta),
      meta,
      htmlSnippet: htmlInfo.htmlSnippet,
      latestSnapshotId: latestSnapshot?.id ?? null,
      latestSnapshotHtmlSizeBytes: htmlInfo.htmlSizeBytes,
      notes: row.notes.map((note) => ({
        id: note.id,
        noteText: note.noteText,
        imageUrls: note.imageUrls,
        sourceContext: (note.sourceContext as Record<string, unknown> | null) ?? null,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
        snapshotId: note.snapshotId,
      })),
      snapshots,
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

export const fetchArchivedPageGroupSummaries = query(
  async (): Promise<ArchivedPageGroupSummary[]> => {
    "use server";
    const rows = await prisma.archivedPage.groupBy({
      by: ["groupName"],
      where: { groupName: { not: null } },
      _count: { _all: true },
      _max: { lastCapturedAt: true },
      orderBy: { _max: { lastCapturedAt: "desc" } },
    });

    return rows
      .map((row) =>
        row.groupName
          ? {
              name: row.groupName,
              count: row._count._all,
              lastCapturedAt: row._max.lastCapturedAt?.toISOString() ?? null,
            }
          : null,
      )
      .filter((value): value is ArchivedPageGroupSummary => Boolean(value));
  },
  "archive-group-summaries",
);

export const fetchArchiveGroupCanvasItems = query(
  async (groupName: string): Promise<ArchivedPageCanvasItem[]> => {
    "use server";
    const group = String(groupName || "").trim();
    if (!group) throw new Error("Missing archive group");

    const rows = await prisma.archivedPage.findMany({
      where: { groupName: group },
      orderBy: [{ lastCapturedAt: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        originalUrl: true,
        groupName: true,
        siteHostname: true,
        canvasX: true,
        canvasY: true,
        canvasCardMode: true,
        meta: true,
        updatedAt: true,
        notes: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 8,
          select: {
            noteText: true,
            imageUrls: true,
            createdAt: true,
          },
        },
      },
    });

    return rows.map((row, index) => {
      const meta = (row.meta as Record<string, unknown> | null) ?? null;
      const latestNoteText =
        row.notes.find((note) => note.noteText.trim())?.noteText ?? null;
      const noteSnippets = row.notes
        .map((note) => note.noteText.trim())
        .filter((noteText) => Boolean(noteText))
        .slice(0, 3);
      const metaDescription = getArchiveMetaDescription(meta);
      const seededPosition = getArchiveCanvasPosition({
        id: row.id,
        title: row.title,
        index,
        canvasX: row.canvasX,
        canvasY: row.canvasY,
      });

      return {
        id: row.id,
        title: row.title,
        originalUrl: row.originalUrl,
        groupName: row.groupName || group,
        siteHostname: row.siteHostname,
        faviconUrl: getArchiveMetaFavicon(meta),
        metaDescription,
        noteSnippets,
        description: getArchiveCanvasDescription({
          meta,
          noteText: latestNoteText,
        }),
        descriptionSource: metaDescription
          ? "meta"
          : latestNoteText?.trim()
            ? "note"
            : null,
        preferredImages: buildArchivePreferredImages({
          meta,
          noteImageUrls: row.notes.map((note) => note.imageUrls),
        }),
        canvasX: seededPosition.x,
        canvasY: seededPosition.y,
        canvasCardMode: normalizeArchiveCanvasCardMode(row.canvasCardMode),
        hasPersistedPosition:
          typeof row.canvasX === "number" && typeof row.canvasY === "number",
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  },
  "archive-group-canvas-items",
);

export const fetchArchiveCanvasOverviewGroups = query(
  async (): Promise<ArchivedPageCanvasOverviewGroup[]> => {
    "use server";

    const rows = await prisma.archivedPage.findMany({
      where: { groupName: { not: null } },
      orderBy: [{ updatedAt: "desc" }, { lastCapturedAt: "desc" }, { id: "asc" }],
      select: {
        groupName: true,
        updatedAt: true,
        meta: true,
        title: true,
        notes: {
          take: 3,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            imageUrls: true,
          },
        },
      },
      take: 500,
    });

    const grouped = new Map<string, ArchivedPageCanvasOverviewGroup>();

    for (const row of rows) {
      const groupName = row.groupName?.trim();
      if (!groupName) continue;
      const existing = grouped.get(groupName);
      const meta = (row.meta as Record<string, unknown> | null) ?? null;

      if (!existing) {
        grouped.set(groupName, {
          name: groupName,
          count: 1,
          latestUpdatedAt: row.updatedAt.toISOString(),
          previewImages: buildArchivePreferredImages({
            meta,
            noteImageUrls: row.notes.map((note) => note.imageUrls ?? []),
            limit: 3,
          }),
          sampleTitles: [row.title],
        });
        continue;
      }

      existing.count += 1;
      if (existing.sampleTitles.length < 3) {
        existing.sampleTitles.push(row.title);
      }
      if (existing.previewImages.length < 3) {
        const nextImages = buildArchivePreferredImages({
          meta,
          noteImageUrls: row.notes.map((note) => note.imageUrls ?? []),
          limit: 3,
        });
        for (const image of nextImages) {
          if (existing.previewImages.includes(image)) continue;
          existing.previewImages.push(image);
          if (existing.previewImages.length >= 3) break;
        }
      }
    }

    return Array.from(grouped.values()).sort((a, b) => {
      const aTime = a.latestUpdatedAt ? Date.parse(a.latestUpdatedAt) : 0;
      const bTime = b.latestUpdatedAt ? Date.parse(b.latestUpdatedAt) : 0;
      return bTime - aTime || a.name.localeCompare(b.name);
    });
  },
  "archive-canvas-overview-groups",
);

export const fetchArchiveAdminSnapshots = query(
  async (): Promise<ArchiveAdminSnapshotItem[]> => {
    "use server";
    const rows = await prisma.archivedPageSnapshot.findMany({
      orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
      take: 150,
      select: {
        id: true,
        archivedPageId: true,
        captureMode: true,
        capturedAt: true,
        groupName: true,
        htmlPath: true,
        htmlHash: true,
        textSnippet: true,
        archivedPage: {
          select: {
            title: true,
            originalUrl: true,
          },
        },
      },
    });

    const items = await Promise.all(
      rows.map(async (row) => {
        const htmlInfo = await readArchiveHtmlInfo(row.htmlPath);
        return {
          id: row.id,
          archivedPageId: row.archivedPageId,
          pageTitle: row.archivedPage.title,
          originalUrl: row.archivedPage.originalUrl,
          groupName: row.groupName,
          captureMode: row.captureMode,
          capturedAt: row.capturedAt.toISOString(),
          htmlPath: row.htmlPath,
          htmlSizeBytes: htmlInfo.htmlSizeBytes,
          htmlHash: row.htmlHash,
          textSnippet: row.textSnippet,
        } satisfies ArchiveAdminSnapshotItem;
      }),
    );

    return items;
  },
  "archive-admin-snapshots",
);

export const fetchArchiveAdminSnapshotDetail = query(
  async (id: string): Promise<ArchiveAdminSnapshotDetail> => {
    "use server";
    const snapshotId = String(id || "").trim();
    if (!snapshotId) throw new Error("Missing snapshot id");

    const row = await prisma.archivedPageSnapshot.findUnique({
      where: { id: snapshotId },
      select: {
        id: true,
        archivedPageId: true,
        captureMode: true,
        capturedAt: true,
        groupName: true,
        htmlPath: true,
        htmlHash: true,
        textSnippet: true,
        meta: true,
        archivedPage: {
          select: {
            title: true,
            originalUrl: true,
          },
        },
      },
    });

    if (!row) throw new Error("Snapshot not found");
    const htmlInfo = await readArchiveHtmlInfo(row.htmlPath);

    return {
      id: row.id,
      archivedPageId: row.archivedPageId,
      pageTitle: row.archivedPage.title,
      originalUrl: row.archivedPage.originalUrl,
      groupName: row.groupName,
      captureMode: row.captureMode,
      capturedAt: row.capturedAt.toISOString(),
      htmlPath: row.htmlPath,
      htmlSizeBytes: htmlInfo.htmlSizeBytes,
      htmlHash: row.htmlHash,
      textSnippet: row.textSnippet,
      meta: (row.meta as Record<string, unknown> | null) ?? null,
    };
  },
  "archive-admin-snapshot-detail",
);
