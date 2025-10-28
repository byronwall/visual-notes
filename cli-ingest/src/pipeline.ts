import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getSourceTag, globalCliOptions, logger } from "./cli";
import { loadSkipIndex, mergeSkipIndex, saveSkipIndex } from "./io/skipIndex";
import { fetchInventory } from "./services/inventory";
import { planUploads, postBatches } from "./services/uploader";
import { htmlToMarkdown } from "./transforms/htmlToMarkdown";
import { inlineRelativeImages } from "./transforms/inlineImages";
import { ExportedNote, IngestSource, RawNote } from "./types";
import { htmlDirSource } from "./sources/htmlDir";
import { notionMdSource } from "./sources/notionMd";
import { chatgptHtmlSource } from "./sources/chatgptHtml";

export async function runPipeline() {
  const outDir = globalCliOptions.outDir ?? join(process.cwd(), "out");
  mkdirSync(outDir, { recursive: true });

  const source: IngestSource = await resolveSource();

  logger.info(`[ingest] source=${source.name} limit=${globalCliOptions.limit}`);
  const { notes, meta, skipLogs } = await source.load({
    limit: globalCliOptions.limit,
    verbose: globalCliOptions.verbose,
  });

  if (skipLogs?.length) {
    const counts = countBy(skipLogs, (s) => s.reason);
    const reportPath = join(outDir, "skip-report.json");
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          total: skipLogs.length,
          counts,
          entries: skipLogs,
        },
        null,
        2
      )
    );
    logger.info(`[ingest] wrote skip report -> ${reportPath}`);
  }

  const limited =
    globalCliOptions.limit > 0 && notes.length > globalCliOptions.limit
      ? notes.slice(0, globalCliOptions.limit)
      : notes;

  // TODO: clean up this "should convert to markdown" logic - CLI should decide, not user
  const exported: ExportedNote[] = globalCliOptions.markdown
    ? convertToMarkdown(limited)
    : [];

  // TODO: why `split` - give a better name about "write markdown to disk"
  if (globalCliOptions.markdown && globalCliOptions.split) {
    const splitDir = globalCliOptions.splitDir ?? join(outDir, "notes-md3");
    mkdirSync(splitDir, { recursive: true });
    exported.forEach((n: ExportedNote, i: number) => {
      const idx = String(i + 1).padStart(String(exported.length).length, "0");
      const name = sanitizeFilename(n.title || "note", n.id);
      const path = join(splitDir, `${idx}-${name}.md`);
      writeFileSync(path, n.markdown);
    });
    logger.info(`[ingest] wrote split markdown -> ${splitDir}`);
  }

  // TODO: why is this here? should do the skipping during ingest - not export
  // TODO: can rely on teh server rejecting bad uploads
  if (globalCliOptions.skipIndex) {
    const existing = loadSkipIndex(globalCliOptions.skipIndex);
    const merged = mergeSkipIndex(existing, limited);
    saveSkipIndex(globalCliOptions.skipIndex, merged);
    logger.info(
      `[ingest] skip-index updated (${Object.keys(merged).length} ids)`
    );
  }

  if (globalCliOptions.post) {
    const inv = globalCliOptions.prefetchInventory
      ? await fetchInventory(globalCliOptions.serverUrl, getSourceTag())
      : {};
    const { candidates, reasons } = planUploads(exported, inv);
    logger.info(
      `[post] candidates=${candidates.length} reasons=${Object.entries(reasons)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`
    );
    const { ok, fail } = await postBatches(
      globalCliOptions.serverUrl,
      getSourceTag(),
      candidates,
      globalCliOptions.batchSize,
      globalThis.fetch,
      (m) => logger.warn(m)
    );
    logger.info(`[post] done ok=${ok} fail=${fail}`);
  }
}

function convertToMarkdown(raw: RawNote[]): ExportedNote[] {
  return raw.map((n) => {
    // Prefer inline HTML if present; otherwise, read from filePath when available
    let bodyHtml: string = typeof n.html === "string" ? n.html : "";
    if ((!bodyHtml || bodyHtml.trim().length === 0) && n.filePath) {
      try {
        const full = readFileSync(n.filePath, "utf8");
        const match = full.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        bodyHtml = match ? match[1] : full;
      } catch (e) {
        logger.warn(
          `[ingest] failed reading HTML file at ${n.filePath}: ${
            e instanceof Error ? e.message : String(e)
          }`
        );
        bodyHtml = "";
      }
    }
    const md = htmlToMarkdown(bodyHtml);
    const mdWithImages = inlineRelativeImages(md, n.folder);
    return { ...n, markdown: mdWithImages };
  });
}

// TODO: there are several of these helpers - create a common helpers file.
function sanitizeFilename(title: string, fallbackId: string) {
  const ascii = title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_.]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return ascii.slice(0, 64) || fallbackId.slice(0, 12);
}

async function resolveSource(): Promise<IngestSource> {
  if (globalCliOptions.source === "apple-notes") {
    const { appleNotesSource } = await import("./sources/appleNotes");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    logger.info(`[ingest] resolving source=${globalCliOptions.source}`);

    // TODO: move this into the appleNotesSource function.
    const scriptPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../scripts/export-apple-notes.jxa"
    );
    // Prefetch server inventory and write known IDs file before JXA runs
    // so the script can skip already-known notes efficiently.
    let knownIdsPath: string | undefined = undefined;
    if (globalCliOptions.prefetchInventory || globalCliOptions.post) {
      try {
        const inv = await fetchInventory(
          globalCliOptions.serverUrl,
          getSourceTag()
        );
        const knownIds: Record<string, string> = {};
        for (const [id, meta] of Object.entries(inv))
          knownIds[id] = meta.updatedAt;
        knownIdsPath = join(globalCliOptions.outDir, "server-inventory.json");
        writeFileSync(knownIdsPath, JSON.stringify(knownIds, null, 2));
        logger.info(`[ingest] wrote server inventory -> ${knownIdsPath}`);
      } catch (e) {
        logger.warn(
          `[ingest] inventory prefetch failed: ${
            e instanceof Error ? e.message : String(e)
          }`,
          globalCliOptions.serverUrl,
          getSourceTag()
        );
      }
    }
    return appleNotesSource(scriptPath, knownIdsPath);
  }

  if (globalCliOptions.source === "html-dir") {
    if (!globalCliOptions.fromHtmlDir)
      throw new Error("--from-html-dir is required for source=html-dir");
    return htmlDirSource(globalCliOptions.fromHtmlDir);
  }
  if (globalCliOptions.source === "notion-md") {
    if (!globalCliOptions.notionRoot)
      throw new Error("--notion-root is required for source=notion-md");
    return notionMdSource(globalCliOptions.notionRoot);
  }

  if (globalCliOptions.source === "chatgpt-html") {
    if (!("chatHtmlRoot" in globalCliOptions) || !globalCliOptions.chatHtmlRoot)
      throw new Error("--chat-html-root is required for source=chatgpt-html");
    return chatgptHtmlSource(
      globalCliOptions.chatHtmlRoot as unknown as string
    );
  }

  throw new Error(`Unknown source`);
}

function countBy<T>(arr: T[], key: (t: T) => string) {
  const out: Record<string, number> = {};
  for (const x of arr) out[key(x)] = (out[key(x)] ?? 0) + 1;
  return out;
}
