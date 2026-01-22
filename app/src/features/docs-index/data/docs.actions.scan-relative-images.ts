import { action } from "@solidjs/router";
import { prisma } from "~/server/db";
import type { ScanRelativeImagesResult } from "./docs.types";
import { hasRelativeImageInMarkdown } from "./docs.scan-relative-images.helpers";

export const scanRelativeImages = action(
  async (options?: { dryRun?: boolean }): Promise<ScanRelativeImagesResult> => {
    "use server";
    const dryRun = Boolean(options?.dryRun);
    const idRows = await prisma.doc.findMany({ select: { id: true } });
    const total = idRows.length;
    let considered = 0;
    let readFailures = 0;
    let matches = 0;
    const candidates: { id: string; meta: Record<string, unknown> | null }[] = [];

    const batchSize = 200;
    console.log(
      "[docs.scan-relative-images] scanning total=%d batchSize=%d",
      total,
      batchSize
    );
    for (let i = 0; i < idRows.length; i += batchSize) {
      const batch = idRows.slice(i, i + batchSize);
      for (const row of batch) {
        try {
          const doc = await prisma.doc.findUnique({
            where: { id: row.id },
            select: { id: true, markdown: true, meta: true },
          });
          if (!doc) continue;
          considered++;
          if (hasRelativeImageInMarkdown(doc.markdown as string | undefined)) {
            matches++;
            const currentMeta =
              (doc.meta as Record<string, unknown> | null) || null;
            const alreadyTrue =
              !!currentMeta && currentMeta["has_relative_image"] === true;
            if (!alreadyTrue) candidates.push({ id: doc.id, meta: currentMeta });
          }
          if (considered % 100 === 0) {
            console.log(
              "[docs.scan-relative-images] progress considered=%d/%d matches=%d readFailures=%d candidates=%d",
              considered,
              total,
              matches,
              readFailures,
              candidates.length
            );
          }
        } catch (e) {
          readFailures++;
          console.log(
            "[docs.scan-relative-images] read failure for id=%s: %s",
            row.id,
            e instanceof Error ? e.message : String(e)
          );
        }
      }
    }

    if (dryRun) {
      console.log(
        "[docs.scan-relative-images] dryRun considered=%d/%d matches=%d readFailures=%d",
        considered,
        total,
        matches,
        readFailures
      );
      return {
        ok: true,
        total,
        considered,
        matches,
        dryRun: true,
        readFailures,
      };
    }

    if (candidates.length === 0) {
      return {
        ok: true,
        total,
        considered,
        matches,
        updated: 0,
        failed: 0,
        readFailures,
      };
    }

    const chunkSize = 100;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < candidates.length; i += chunkSize) {
      const chunk = candidates.slice(i, i + chunkSize);
      console.log(
        "[docs.scan-relative-images] updating chunk=%d/%d size=%d",
        Math.floor(i / chunkSize) + 1,
        Math.ceil(candidates.length / chunkSize),
        chunk.length
      );
      try {
        await prisma.$transaction(
          chunk.map((c) =>
            prisma.doc.update({
              where: { id: c.id },
              data: {
                meta: {
                  ...(c.meta || {}),
                  has_relative_image: true,
                },
              },
            })
          )
        );
        updated += chunk.length;
      } catch (e) {
        console.error(
          "[docs.scan-relative-images] chunk failed, retrying individually",
          e
        );
        for (const c of chunk) {
          try {
            await prisma.doc.update({
              where: { id: c.id },
              data: {
                meta: {
                  ...(c.meta || {}),
                  has_relative_image: true,
                },
              },
            });
            updated++;
          } catch (_e) {
            failed++;
          }
        }
      }
    }

    console.log(
      "[docs.scan-relative-images] completed updated=%d failed=%d considered=%d/%d matches=%d readFailures=%d",
      updated,
      failed,
      considered,
      total,
      matches,
      readFailures
    );

    return {
      ok: true,
      total,
      considered,
      matches,
      updated,
      failed,
      readFailures,
    };
  },
  "docs-scan-relative-images"
);
