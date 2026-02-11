import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { query } from "@solidjs/router";
import { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import { resolveDocImageStorageDir } from "~/server/lib/inline-image-migration";
import type { InlineImageMigrationStatus } from "./inline-image-migration.types";

const RECENT_BACKUPS_LIMIT = 30;
const BIGGEST_IMAGE_FILES_LIMIT = 10;
const STAT_BATCH_SIZE = 64;

type ImageStorageFile = InlineImageMigrationStatus["imageStorage"]["files"][number];

type MigrationCountsRow = {
  totalDocs: bigint;
  docsWithInlineDataImages: bigint;
  docsWithBackup: bigint;
  docsWithBackupAndStillInlineDataImages: bigint;
  docsRewrittenToDiskUrls: bigint;
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
    const storageDir = resolveDocImageStorageDir();
    let imageFiles: InlineImageMigrationStatus["imageStorage"]["files"] = [];
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

    const [
      counts,
      recentBackups,
    ] = await Promise.all([
      prisma.$queryRaw<MigrationCountsRow[]>(Prisma.sql`
        SELECT
          COUNT(*)::bigint AS "totalDocs",
          COUNT(*) FILTER (
            WHERE
              POSITION('data:image' IN LOWER(COALESCE("html", ''))) > 0
              OR POSITION('data:image' IN LOWER(COALESCE("markdown", ''))) > 0
          )::bigint AS "docsWithInlineDataImages",
          COUNT(*) FILTER (
            WHERE "inlineImageMigrationBackup" IS NOT NULL
          )::bigint AS "docsWithBackup",
          COUNT(*) FILTER (
            WHERE "inlineImageMigrationBackup" IS NOT NULL
              AND (
                POSITION('data:image' IN LOWER(COALESCE("html", ''))) > 0
                OR POSITION('data:image' IN LOWER(COALESCE("markdown", ''))) > 0
              )
          )::bigint AS "docsWithBackupAndStillInlineDataImages",
          COUNT(*) FILTER (
            WHERE
              POSITION('/api/doc-images/' IN COALESCE("html", '')) > 0
              OR POSITION('/api/doc-images/' IN COALESCE("markdown", '')) > 0
          )::bigint AS "docsRewrittenToDiskUrls"
        FROM "Doc"
      `),
      prisma.doc.findMany({
        where: { inlineImageMigrationBackup: { not: Prisma.AnyNull } },
        select: {
          id: true,
          title: true,
          updatedAt: true,
          markdown: true,
          html: true,
          path: true,
          meta: true,
        },
        orderBy: { updatedAt: "desc" },
        take: RECENT_BACKUPS_LIMIT,
      }),
    ]);
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
      recentBackups: recentBackups.map((d) => ({
        id: d.id,
        title: d.title,
        updatedAt: d.updatedAt.toISOString(),
        path: d.path,
        meta: d.meta as Record<string, unknown> | null,
        previewDoc: {
          markdown: d.markdown,
          html: d.html,
          path: d.path,
          meta: d.meta as Record<string, unknown> | null,
        },
      })),
      imageStorage: {
        dirExists,
        fileCount: imageFileCount,
        totalBytes: totalImageBytes,
        files: imageFiles,
      },
    };
  },
  "admin-inline-image-migration-status"
);
