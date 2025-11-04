import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";
import { marked } from "marked";

type ScanResult = {
  ok: boolean;
  total: number;
  considered: number; // successfully read docs
  matches: number;
  updated?: number;
  failed?: number;
  dryRun?: boolean;
  readFailures?: number;
};

function isRelativeUrl(u: string): boolean {
  const url = u.trim();
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith("data:")) return false; // exclude data URLs
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) return false; // has scheme
  // Treat root-relative and path-relative as relative for our purposes
  return true;
}

function hasRelativeImageInMarkdown(
  markdown: string | null | undefined
): boolean {
  if (!markdown || !markdown.trim()) return false;
  try {
    const tokens = marked.lexer(markdown);
    // Inline images can appear inside paragraph/text tokens; walk recursively
    const stack: any[] = Array.isArray(tokens) ? [...tokens] : [];
    while (stack.length > 0) {
      const tok: any = stack.pop();
      if (!tok) continue;
      // Image token
      if (tok.type === "image" && typeof tok.href === "string") {
        if (isRelativeUrl(tok.href)) return true;
      }
      // Some tokens contain inline tokens array
      if (tok.tokens && Array.isArray(tok.tokens)) {
        for (const t of tok.tokens) stack.push(t);
      }
      // Lists/blocks can contain nested items/children
      if (Array.isArray(tok.items)) {
        for (const it of tok.items) {
          if (it.tokens && Array.isArray(it.tokens)) {
            for (const t of it.tokens) stack.push(t);
          }
        }
      }
      if (Array.isArray(tok.children)) {
        for (const c of tok.children) stack.push(c);
      }
    }
  } catch (e) {
    console.log(
      "[api.docs.scan-relative-images] markdown parse failed:",
      e instanceof Error ? e.message : String(e)
    );
  }
  return false;
}

export async function POST(event: APIEvent) {
  const url = new URL(event.request.url);
  const dryRun =
    url.searchParams.get("dryRun") === "1" ||
    url.searchParams.get("dryRun") === "true";

  // Fetch ids only to avoid loading huge strings in one call
  const idRows = await prisma.doc.findMany({ select: { id: true } });
  const total = idRows.length;
  let considered = 0;
  let readFailures = 0;
  let matches = 0;
  const candidates: { id: string; meta: Record<string, unknown> | null }[] = [];

  const batchSize = 200;
  console.log(
    "[api.docs.scan-relative-images] scanning total=%d batchSize=%d",
    total,
    batchSize
  );
  for (let i = 0; i < idRows.length; i += batchSize) {
    const batch = idRows.slice(i, i + batchSize);
    // Read each item individually so a single bad row doesn't fail the batch
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
            "[api.docs.scan-relative-images] progress considered=%d/%d matches=%d readFailures=%d candidates=%d",
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
          "[api.docs.scan-relative-images] read failure for id=%s: %s",
          row.id,
          e instanceof Error ? e.message : String(e)
        );
      }
    }
  }

  if (dryRun) {
    console.log(
      "[api.docs.scan-relative-images] dryRun considered=%d/%d matches=%d readFailures=%d",
      considered,
      total,
      matches,
      readFailures
    );
    const res: ScanResult = {
      ok: true,
      total,
      considered,
      matches,
      dryRun: true,
      readFailures,
    };
    return json(res);
  }

  if (candidates.length === 0) {
    const res: ScanResult = {
      ok: true,
      total,
      considered,
      matches,
      updated: 0,
      failed: 0,
      readFailures,
    };
    return json(res);
  }

  const chunkSize = 100;
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i += chunkSize) {
    const chunk = candidates.slice(i, i + chunkSize);
    console.log(
      "[api.docs.scan-relative-images] updating chunk=%d/%d size=%d",
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
        "[api.docs.scan-relative-images] chunk failed, retrying individually",
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
    "[api.docs.scan-relative-images] completed updated=%d failed=%d considered=%d/%d matches=%d readFailures=%d",
    updated,
    failed,
    considered,
    total,
    matches,
    readFailures
  );

  const res: ScanResult = {
    ok: true,
    total,
    considered,
    matches,
    updated,
    failed,
    readFailures,
  };
  return json(res);
}
