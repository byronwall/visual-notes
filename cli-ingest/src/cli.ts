import { Command, program } from "commander";
import { z } from "zod";
import { createLogger } from "./logger";
import { runPipeline } from "./pipeline";
import { join } from "node:path";

// TODO: Major work to be done still:
// Verify that option passing and global stuff is OK
// Confirm that apple notes still works
// Clean up various code paths to locate code where it's needed

const Base = z.object({
  source: z.enum(["apple-notes", "html-dir", "notion-md"]),
  limit: z.coerce.number().int().positive().default(200),
  verbose: z.coerce.boolean().default(false),
  markdown: z.coerce.boolean().default(true),
  split: z.coerce.boolean().default(false),
  splitDir: z.string().optional(),
  outDir: z.string().optional().default(join(process.cwd(), "out")),
  jxaRawDir: z.string().optional(),
  inlineJson: z.coerce.boolean().default(false),
  debugJxa: z.coerce.boolean().default(false),
  jxaStdout: z.coerce.boolean().default(true),
  allowDummy: z.coerce.boolean().default(false),
  post: z.coerce.boolean().default(false),
  serverUrl: z.string().url().default("http://localhost:3000"),
  sourceTag: z.string().optional(),
  batchSize: z.coerce.number().int().positive().default(20),
  skipIndex: z.string().optional(),
  prefetchInventory: z.coerce.boolean().default(false),
});

const AppleNotes = Base.extend({
  source: z.literal("apple-notes"),
});

const HtmlDir = Base.extend({
  source: z.literal("html-dir"),
  fromHtmlDir: z.string().min(1, "Provide --from-html-dir for html-dir source"),
});

const NotionMd = Base.extend({
  source: z.literal("notion-md"),
  notionRoot: z.string().min(1, "Provide --notion-root for notion-md source"),
});

const CliSchema = z.discriminatedUnion("source", [
  AppleNotes,
  HtmlDir,
  NotionMd,
]);
export type IngestOptions = z.infer<typeof CliSchema>;

// forcing types here since a validated object will overwrite if CLI succeeds
export const globalCliOptions: IngestOptions = {} as IngestOptions;

export function getSourceTag() {
  return (
    globalCliOptions.sourceTag ??
    process.env.INGEST_SOURCE ??
    globalCliOptions.source
  );
}

export async function parseCli(
  argv: readonly string[]
): Promise<IngestOptions> {
  program
    .name("visual-notes-ingest")
    .option("--source <source>", "apple-notes | html-dir | notion-md")
    .option("-n, --limit <n>", "max notes")
    .option("--markdown", "convert to markdown")
    .option("--split", "write split .md files")
    .option("--split-dir <path>", "output dir for split markdown")
    .option("--out-dir <path>", "output root (default: ./out)")
    .option("--jxa-raw-dir <path>", "write raw HTML to dir (apple-notes)")
    .option("--inline-json", "JXA returns inline HTML in JSON")
    .option("--debug-jxa", "enable extra JXA debug")
    .option("--jxa-stdout", "passthrough JXA stdout")
    .option("--allow-dummy", "fall back to dummy data on JXA failure")
    .option("--from-html-dir <path>", "read HTML files (html-dir)")
    .option(
      "--notion-root <path>",
      "root of Notion exported Markdown tree (notion-md)"
    )
    .option("--post", "POST to server")
    .option("--server-url <url>", "server base URL")
    .option("--source-tag <name>", "source tag for server")
    .option("--batch-size <n>", "POST batch size")
    .option("--skip-index <path>", "skip-index file")
    .option("--prefetch-inventory", "prefetch remote inventory")
    .option("-v, --verbose", "verbose logging");

  await program.parseAsync(argv);

  const raw = program.opts();

  const parsed = CliSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.flatten();
    const details = JSON.stringify(issues, null, 2);
    console.error("[cli] invalid options:\n", { details, issues, raw });
    throw parsed.error;
  }

  console.log("[cli] parsed options:", parsed.data);

  return parsed.data;
}

export const logger = createLogger(globalCliOptions.verbose);

// TODO: allow top level await
(async () => {
  try {
    const parsedOptions = await parseCli(process.argv);

    // assign parsed options to globalCliOptions so available to the pipeline
    Object.assign(globalCliOptions, parsedOptions);
  } catch (e) {
    process.exit(2);
  }

  try {
    console.log("[cli] invoking pipeline…");
    await runPipeline();
    console.log("[cli] pipeline complete");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(msg);
    process.exit(1);
  }
})();
