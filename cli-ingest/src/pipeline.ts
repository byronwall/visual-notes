import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { IngestSource, ExportedNote, RawNote } from "./types";
import { htmlToMarkdown } from "./transforms/htmlToMarkdown";
import { loadSkipIndex, mergeSkipIndex, saveSkipIndex } from "./io/skipIndex";
import { fetchInventory } from "./services/inventory";
import { planUploads, postBatches } from "./services/uploader";

export async function runPipeline(
  opts: any, // TODO: type this
  logger: ReturnType<typeof import("./logger").createLogger> // TODO: type this
) {
  const outDir = opts.outDir ?? join(process.cwd(), "out");
  mkdirSync(outDir, { recursive: true });

  const source: IngestSource = await resolveSource(opts);

  logger.info(`[ingest] source=${source.name} limit=${opts.limit}`);
  const { notes, meta, skipLogs } = await source.load({
    limit: opts.limit,
    verbose: opts.verbose,
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
    opts.limit > 0 && notes.length > opts.limit
      ? notes.slice(0, opts.limit)
      : notes;

  // TODO: clean up this "should convert to markdown" logic - CLI should decide, not user
  const exported: ExportedNote[] = opts.markdown
    ? convertToMarkdown(limited)
    : [];

  // TODO: not clear why this switch is here or what the file does
  const jsonPath = join(
    outDir,
    opts.markdown ? "notes.json" : "raw-index.json"
  );
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        noteCount: opts.markdown ? exported.length : limited.length,
        notes: opts.markdown ? exported : limited,
        meta,
      },
      null,
      2
    )
  );
  logger.info(
    `[ingest] wrote ${opts.markdown ? "markdown" : "raw"} index -> ${jsonPath}`
  );

  // TODO: why `split` - give a better name about "write markdown to disk"
  if (opts.markdown && opts.split) {
    const splitDir = opts.splitDir ?? join(outDir, "notes-md");
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
  if (opts.skipIndex) {
    const existing = loadSkipIndex(opts.skipIndex);
    const merged = mergeSkipIndex(existing, limited);
    saveSkipIndex(opts.skipIndex, merged);
    logger.info(
      `[ingest] skip-index updated (${Object.keys(merged).length} ids)`
    );
  }

  if (opts.post) {
    const inv = opts.prefetchInventory
      ? await fetchInventory(opts.serverUrl, opts.sourceTag)
      : {};
    const { candidates, reasons } = planUploads(exported, inv);
    logger.info(
      `[post] candidates=${candidates.length} reasons=${Object.entries(reasons)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`
    );
    const { ok, fail } = await postBatches(
      opts.serverUrl,
      opts.sourceTag,
      candidates,
      opts.batchSize,
      globalThis.fetch,
      (m) => logger.warn(m)
    );
    logger.info(`[post] done ok=${ok} fail=${fail}`);
  }
}

function convertToMarkdown(raw: RawNote[]): ExportedNote[] {
  return raw.map((n) => {
    const bodyHtml = n.html ?? "";
    const md = htmlToMarkdown(bodyHtml);
    return { ...n, markdown: md };
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

async function resolveSource(opts: any): Promise<IngestSource> {
  if (opts.source === "apple-notes") {
    const { appleNotesSource } = await import("./sources/appleNotes");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const scriptPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../scripts/export-apple-notes.jxa"
    );
    // TODO: code like this points to a global options object being useful.
    return appleNotesSource({
      scriptPath,
      jxaRawDir: opts.jxaRawDir,
      inlineJson: opts.inlineJson,
      debugJxa: opts.debugJxa,
      jxaStdout: opts.jxaStdout,
      allowDummy: opts.allowDummy,
      knownIdsPath: undefined,
    });
  }

  // TODO: don't do these lazy imports - just import and call w/ cleaner code
  if (opts.source === "html-dir") {
    const { htmlDirSource } = await import("./sources/htmlDir");
    if (!opts.fromHtmlDir)
      throw new Error("--from-html-dir is required for source=html-dir");
    return htmlDirSource(opts.fromHtmlDir);
  }
  if (opts.source === "notion-md") {
    const { notionMdSource } = await import("./sources/notionMd");
    if (!opts.notionRoot)
      throw new Error("--notion-root is required for source=notion-md");
    return notionMdSource(opts.notionRoot);
  }
  throw new Error(`Unknown source: ${opts.source}`);
}

function countBy<T>(arr: T[], key: (t: T) => string) {
  const out: Record<string, number> = {};
  for (const x of arr) out[key(x)] = (out[key(x)] ?? 0) + 1;
  return out;
}
