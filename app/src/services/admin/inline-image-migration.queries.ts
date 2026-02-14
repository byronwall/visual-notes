import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { query } from "@solidjs/router";
import { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import { resolveDocImageStorageDir } from "~/server/lib/inline-image-migration";
import type {
  InlineImageMigrationCountsStatus,
  InlineImageMigrationImageStorageStatus,
  InlineImageMigrationRecentBackup,
  InlineImageMigrationStatus,
} from "./inline-image-migration.types";

const RECENT_BACKUPS_LIMIT = 30;
const BIGGEST_IMAGE_FILES_LIMIT = 10;
const STAT_BATCH_SIZE = 64;

type ImageStorageFile = InlineImageMigrationImageStorageStatus["files"][number];

type MigrationCountsRow = {
  totalDocs: bigint;
  docsWithInlineDataImages: bigint;
  docsWithBackup: bigint;
  docsWithBackupAndStillInlineDataImages: bigint;
  docsRewrittenToDiskUrls: bigint;
};

type RecentBackupRow = {
  id: string;
  title: string;
  updatedAt: Date;
  path: string | null;
  meta: Prisma.JsonValue | null;
  snippet: string;
};

function parseCount(value: bigint): number {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : 0;
}

function shouldSortBefore(a: ImageStorageFile, b: ImageStorageFile): boolean {
  if (a.sizeBytes !== b.sizeBytes) return a.sizeBytes > b.sizeBytes;
  return a.name.localeCompare(b.name) < 0;
}

function insertTopBySize(
  top: ImageStorageFile[],
  next: ImageStorageFile,
  limit: number
) {
  let insertAt = top.length;
  for (let i = 0; i < top.length; i += 1) {
    if (shouldSortBefore(next, top[i])) {
      insertAt = i;
      break;
    }
  }
  top.splice(insertAt, 0, next);
  if (top.length > limit) top.pop();
}

export const fetchInlineImageMigrationStatus = query(
  async (): Promise<InlineImageMigrationStatus> => {
    "use server";
    const [counts, recentBackups, imageStorage] = await Promise.all([
      fetchInlineImageMigrationCounts(),
      fetchInlineImageMigrationRecentBackups(),
      fetchInlineImageMigrationImageStorage(),
    ]);
    return {
      ...counts,
      recentBackups,
      imageStorage: {
        dirExists: imageStorage.dirExists,
        fileCount: imageStorage.fileCount,
        totalBytes: imageStorage.totalBytes,
        files: imageStorage.files,
      },
    };
  },
  "admin-inline-image-migration-status"
);

export const fetchInlineImageMigrationCounts = query(
  async (): Promise<InlineImageMigrationCountsStatus> => {
    "use server";
    const storageDir = resolveDocImageStorageDir();
    const counts = await prisma.$queryRaw<MigrationCountsRow[]>(Prisma.sql`
      WITH doc_flags AS (
        SELECT
          "inlineImageMigrationBackup" IS NOT NULL AS has_backup,
          (
            COALESCE("html", '') ILIKE '%data:image%'
            OR COALESCE("markdown", '') ILIKE '%data:image%'
          ) AS has_inline_data,
          (
            POSITION('/api/doc-images/' IN COALESCE("html", '')) > 0
            OR POSITION('/api/doc-images/' IN COALESCE("markdown", '')) > 0
          ) AS has_disk_url
        FROM "Doc"
      )
      SELECT
        COUNT(*)::bigint AS "totalDocs",
        COUNT(*) FILTER (WHERE has_inline_data)::bigint AS "docsWithInlineDataImages",
        COUNT(*) FILTER (WHERE has_backup)::bigint AS "docsWithBackup",
        COUNT(*) FILTER (
          WHERE has_backup AND has_inline_data
        )::bigint AS "docsWithBackupAndStillInlineDataImages",
        COUNT(*) FILTER (WHERE has_disk_url)::bigint AS "docsRewrittenToDiskUrls"
      FROM doc_flags
    `);
    const row = counts[0];
    const totalDocs = row ? parseCount(row.totalDocs) : 0;
    const docsWithInlineDataImages = row
      ? parseCount(row.docsWithInlineDataImages)
      : 0;
    const docsWithBackup = row ? parseCount(row.docsWithBackup) : 0;
    const docsWithBackupAndStillInlineDataImages = row
      ? parseCount(row.docsWithBackupAndStillInlineDataImages)
      : 0;
    const docsRewrittenToDiskUrls = row
      ? parseCount(row.docsRewrittenToDiskUrls)
      : 0;

    return {
      totalDocs,
      docsWithInlineDataImages,
      docsWithBackup,
      docsWithBackupAndStillInlineDataImages,
      docsRewrittenToDiskUrls,
      storageDir,
    };
  },
  "admin-inline-image-migration-counts"
);

export const fetchInlineImageMigrationRecentBackups = query(
  async (): Promise<InlineImageMigrationRecentBackup[]> => {
    "use server";
    const recentBackups = await prisma.$queryRaw<RecentBackupRow[]>(Prisma.sql`
      SELECT
        "id",
        "title",
        "updatedAt",
        "path",
        "meta",
        LEFT(COALESCE(NULLIF("markdown", ''), NULLIF("html", ''), ''), 1200) AS "snippet"
      FROM "Doc"
      WHERE "inlineImageMigrationBackup" IS NOT NULL
      ORDER BY "updatedAt" DESC
      LIMIT ${RECENT_BACKUPS_LIMIT}
    `);
    return recentBackups.map((d) => ({
      id: d.id,
      title: d.title,
      updatedAt: d.updatedAt.toISOString(),
      path: d.path,
      meta: d.meta as Record<string, unknown> | null,
      snippet: d.snippet,
    }));
  },
  "admin-inline-image-migration-recent-backups"
);

export const fetchInlineImageMigrationImageStorage = query(
  async (): Promise<InlineImageMigrationImageStorageStatus> => {
    "use server";
    const storageDir = resolveDocImageStorageDir();
    let imageFiles: InlineImageMigrationImageStorageStatus["files"] = [];
    let imageFileCount = 0;
    let dirExists = true;
    let totalImageBytes = 0;
    try {
      const entries = await readdir(storageDir, { withFileTypes: true });
      const fileEntries = entries.filter((e) => e.isFile());
      imageFileCount = fileEntries.length;
      const topImageFiles: ImageStorageFile[] = [];
      for (let i = 0; i < fileEntries.length; i += STAT_BATCH_SIZE) {
        const slice = fileEntries.slice(i, i + STAT_BATCH_SIZE);
        const stats = await Promise.all(
          slice.map(async (entry) => {
            const abs = path.join(storageDir, entry.name);
            const st = await stat(abs);
            return {
              name: entry.name,
              sizeBytes: st.size,
              updatedAt: st.mtime.toISOString(),
              url: `/api/doc-images/${entry.name}`,
            };
          })
        );
        for (const file of stats) {
          totalImageBytes += file.sizeBytes;
          insertTopBySize(topImageFiles, file, BIGGEST_IMAGE_FILES_LIMIT);
        }
      }
      imageFiles = topImageFiles;
    } catch (e) {
      const code =
        typeof e === "object" && e && "code" in e
          ? String((e as { code?: unknown }).code || "")
          : "";
      if (code === "ENOENT") {
        dirExists = false;
      } else {
        throw e;
      }
    }
    return {
      storageDir,
      dirExists,
      fileCount: imageFileCount,
      totalBytes: totalImageBytes,
      files: imageFiles,
    };
  },
  "admin-inline-image-migration-image-storage"
);
