import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { query } from "@solidjs/router";
import { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import { resolveDocImageStorageDir } from "~/server/lib/inline-image-migration";
import type { InlineImageMigrationStatus } from "./inline-image-migration.types";

function buildDataImageWhere() {
  return {
    OR: [
      { html: { contains: "data:image", mode: "insensitive" as const } },
      { markdown: { contains: "data:image", mode: "insensitive" as const } },
    ],
  };
}

export const fetchInlineImageMigrationStatus = query(
  async (): Promise<InlineImageMigrationStatus> => {
    "use server";
    const storageDir = resolveDocImageStorageDir();
    let imageFiles: InlineImageMigrationStatus["imageStorage"]["files"] = [];
    let dirExists = true;
    try {
      const entries = await readdir(storageDir, { withFileTypes: true });
      const fileEntries = entries.filter((e) => e.isFile());
      const stats = await Promise.all(
        fileEntries.map(async (entry) => {
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
      imageFiles = stats.sort((a, b) => {
        if (b.sizeBytes !== a.sizeBytes) return b.sizeBytes - a.sizeBytes;
        return a.name.localeCompare(b.name);
      });
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

    const totalImageBytes = imageFiles.reduce((sum, f) => sum + f.sizeBytes, 0);

    const [
      totalDocs,
      docsWithInlineDataImages,
      docsWithBackup,
      docsWithBackupAndStillInlineDataImages,
      docsRewrittenToDiskUrls,
      recentBackups,
    ] = await Promise.all([
      prisma.doc.count(),
      prisma.doc.count({ where: buildDataImageWhere() }),
      prisma.doc.count({
        where: { inlineImageMigrationBackup: { not: Prisma.AnyNull } },
      }),
      prisma.doc.count({
        where: {
          inlineImageMigrationBackup: { not: Prisma.AnyNull },
          ...buildDataImageWhere(),
        },
      }),
      prisma.doc.count({
        where: {
          OR: [
            { html: { contains: "/api/doc-images/" } },
            { markdown: { contains: "/api/doc-images/" } },
          ],
        },
      }),
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
        take: 30,
      }),
    ]);

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
        fileCount: imageFiles.length,
        totalBytes: totalImageBytes,
        files: imageFiles,
      },
    };
  },
  "admin-inline-image-migration-status"
);
