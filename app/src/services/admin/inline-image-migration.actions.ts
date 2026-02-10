import { action } from "@solidjs/router";
import { z } from "zod";
import { prisma } from "~/server/db";
import {
  computeContentHashForDoc,
  ensureJpegForHeicFile,
  extractDataImageUrls,
  extractHeicDocImageUrls,
  parseDocImageNameFromUrl,
  persistDataImage,
  replaceDataUrls,
  replaceExactUrls,
  resolveDocImageStorageDir,
} from "~/server/lib/inline-image-migration";
import type {
  HeicTranscodeBatchResult,
  InlineImageMigrationBatchResult,
} from "./inline-image-migration.types";

const runSchema = z.object({
  limit: z.number().int().min(1).max(200).default(10),
  dryRun: z.boolean().default(false),
});

const recoverSchema = z.object({
  docId: z.string().min(1),
});

const transcodeHeicSchema = z.object({
  limit: z.number().int().min(1).max(200).default(10),
  dryRun: z.boolean().default(false),
});

type DocCandidate = {
  id: string;
  title: string;
  html: string;
  markdown: string;
};

function getCandidateTake(limit: number): number {
  return Math.max(100, limit * 20);
}

function buildDataImageWhere() {
  return {
    OR: [
      { html: { contains: "data:image", mode: "insensitive" as const } },
      { markdown: { contains: "data:image", mode: "insensitive" as const } },
    ],
  };
}

export const runInlineImageMigrationBatch = action(
  async (payload: z.infer<typeof runSchema>): Promise<InlineImageMigrationBatchResult> => {
    "use server";
    const input = runSchema.parse(payload);
    const storageDir = resolveDocImageStorageDir();
    console.log(
      "[admin.inline-image-migration] start limit=%d dryRun=%s storage=%s",
      input.limit,
      input.dryRun,
      storageDir
    );

    const candidates = await prisma.doc.findMany({
      where: buildDataImageWhere(),
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        html: true,
        markdown: true,
        inlineImageMigrationBackup: true,
      },
      take: getCandidateTake(input.limit),
    });

    let scanned = 0;
    let updatedDocs = 0;
    let migratedImageRefs = 0;
    let skippedDocs = 0;
    const failures: Array<{ docId: string; error: string }> = [];

    for (const raw of candidates) {
      if (updatedDocs >= input.limit) break;
      scanned++;
      const doc: DocCandidate = {
        id: raw.id,
        title: raw.title,
        html: String(raw.html || ""),
        markdown: String(raw.markdown || ""),
      };

      const urls = extractDataImageUrls(`${doc.html}\n${doc.markdown}`);
      if (urls.length === 0) {
        skippedDocs++;
        continue;
      }

      if (input.dryRun) {
        updatedDocs++;
        migratedImageRefs += urls.length;
        continue;
      }

      try {
        const replacements = new Map<string, string>();
        for (const dataUrl of urls) {
          const persisted = await persistDataImage(dataUrl, storageDir);
          replacements.set(dataUrl, persisted.publicUrl);
          migratedImageRefs++;
        }

        const nextHtml = replaceDataUrls(doc.html, replacements);
        const nextMarkdown = replaceDataUrls(doc.markdown, replacements);
        if (nextHtml === doc.html && nextMarkdown === doc.markdown) {
          skippedDocs++;
          continue;
        }

        const backup =
          raw.inlineImageMigrationBackup ??
          ({
            version: 1,
            reason: "inline-data-url-rewrite",
            capturedAt: new Date().toISOString(),
            html: doc.html,
            markdown: doc.markdown,
          } as const);

        await prisma.doc.update({
          where: { id: doc.id },
          data: {
            html: nextHtml,
            markdown: nextMarkdown,
            contentHash: computeContentHashForDoc(nextHtml, nextMarkdown),
            inlineImageMigrationBackup: backup,
          },
        });

        updatedDocs++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        failures.push({ docId: doc.id, error: msg });
      }
    }

    console.log(
      "[admin.inline-image-migration] done scanned=%d updated=%d migratedRefs=%d skipped=%d failures=%d",
      scanned,
      updatedDocs,
      migratedImageRefs,
      skippedDocs,
      failures.length
    );

    return {
      dryRun: input.dryRun,
      limit: input.limit,
      scanned,
      updatedDocs,
      migratedImageRefs,
      skippedDocs,
      failures,
    };
  },
  "admin-inline-image-migration-run-batch"
);

export const recoverInlineImageMigrationBackup = action(
  async (payload: z.infer<typeof recoverSchema>) => {
    "use server";
    const input = recoverSchema.parse(payload);
    const doc = await prisma.doc.findUnique({
      where: { id: input.docId },
      select: {
        id: true,
        inlineImageMigrationBackup: true,
      },
    });
    if (!doc) throw new Error("Doc not found");

    const backup = doc.inlineImageMigrationBackup as
      | { html?: unknown; markdown?: unknown }
      | null;
    if (!backup) throw new Error("No migration backup found for this doc");

    const html = typeof backup.html === "string" ? backup.html : "";
    const markdown = typeof backup.markdown === "string" ? backup.markdown : "";
    if (!html && !markdown) {
      throw new Error("Backup is present but does not include recoverable content");
    }

    await prisma.doc.update({
      where: { id: doc.id },
      data: {
        html,
        markdown,
        contentHash: computeContentHashForDoc(html, markdown),
      },
      select: { id: true },
    });

    console.log("[admin.inline-image-migration] recovered backup for doc=%s", doc.id);
    return { ok: true, id: doc.id };
  },
  "admin-inline-image-migration-recover-backup"
);

function buildHeicDocImageWhere() {
  return {
    OR: [
      { html: { contains: "/api/doc-images/", mode: "insensitive" as const } },
      { markdown: { contains: "/api/doc-images/", mode: "insensitive" as const } },
    ],
  };
}

export const runHeicToJpegBatch = action(
  async (
    payload: z.infer<typeof transcodeHeicSchema>
  ): Promise<HeicTranscodeBatchResult> => {
    "use server";
    const input = transcodeHeicSchema.parse(payload);
    const storageDir = resolveDocImageStorageDir();
    console.log(
      "[admin.inline-image-migration] HEIC->JPEG start limit=%d dryRun=%s storage=%s",
      input.limit,
      input.dryRun,
      storageDir
    );

    const candidates = await prisma.doc.findMany({
      where: buildHeicDocImageWhere(),
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        html: true,
        markdown: true,
        inlineImageMigrationBackup: true,
      },
      take: getCandidateTake(input.limit),
    });

    let scanned = 0;
    let updatedDocs = 0;
    let transcodedImages = 0;
    let skippedDocs = 0;
    const failures: Array<{ docId: string; error: string }> = [];

    for (const raw of candidates) {
      if (updatedDocs >= input.limit) break;
      scanned++;
      const html = String(raw.html || "");
      const markdown = String(raw.markdown || "");
      const urls = extractHeicDocImageUrls(`${html}\n${markdown}`);
      if (urls.length === 0) {
        skippedDocs++;
        continue;
      }

      if (input.dryRun) {
        updatedDocs++;
        transcodedImages += urls.length;
        continue;
      }

      try {
        const replacements = new Map<string, string>();
        for (const oldUrl of urls) {
          const fileName = parseDocImageNameFromUrl(oldUrl);
          if (!fileName || !fileName.toLowerCase().endsWith(".heic")) continue;
          const jpeg = await ensureJpegForHeicFile(storageDir, fileName);
          replacements.set(oldUrl, jpeg.publicUrl);
          transcodedImages++;
        }

        if (replacements.size === 0) {
          skippedDocs++;
          continue;
        }

        const nextHtml = replaceExactUrls(html, replacements);
        const nextMarkdown = replaceExactUrls(markdown, replacements);
        if (nextHtml === html && nextMarkdown === markdown) {
          skippedDocs++;
          continue;
        }

        const backup =
          raw.inlineImageMigrationBackup ??
          ({
            version: 1,
            reason: "heic-to-jpeg-rewrite",
            capturedAt: new Date().toISOString(),
            html,
            markdown,
          } as const);

        await prisma.doc.update({
          where: { id: raw.id },
          data: {
            html: nextHtml,
            markdown: nextMarkdown,
            contentHash: computeContentHashForDoc(nextHtml, nextMarkdown),
            inlineImageMigrationBackup: backup,
          },
        });

        updatedDocs++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        failures.push({ docId: raw.id, error: msg });
      }
    }

    console.log(
      "[admin.inline-image-migration] HEIC->JPEG done scanned=%d updated=%d transcoded=%d skipped=%d failures=%d",
      scanned,
      updatedDocs,
      transcodedImages,
      skippedDocs,
      failures.length
    );

    return {
      dryRun: input.dryRun,
      limit: input.limit,
      scanned,
      updatedDocs,
      transcodedImages,
      skippedDocs,
      failures,
    };
  },
  "admin-inline-image-migration-heic-to-jpeg"
);
