import { program, InvalidOptionArgumentError } from "commander";
import { z } from "zod";
import { runPipeline } from "./pipeline";
import { createLogger } from "./logger";

const Base = z.object({
  source: z.enum(["apple-notes", "html-dir", "notion-md"]),
  limit: z.coerce.number().int().positive().default(10),
  verbose: z.coerce.boolean().default(false),
  markdown: z.coerce.boolean().default(true),
  split: z.coerce.boolean().default(false),
  splitDir: z.string().optional(),
  outDir: z.string().optional(),
  jxaRawDir: z.string().optional(),
  inlineJson: z.coerce.boolean().default(false),
  debugJxa: z.coerce.boolean().default(false),
  jxaStdout: z.coerce.boolean().default(false),
  allowDummy: z.coerce.boolean().default(false),
  post: z.coerce.boolean().default(false),
  serverUrl: z.string().url().default("http://localhost:3000"),
  sourceTag: z.string().default(process.env.INGEST_SOURCE ?? "local"),
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
});

const CliSchema = z.discriminatedUnion("source", [
  AppleNotes,
  HtmlDir,
  NotionMd,
]);
export type IngestOptions = z.infer<typeof CliSchema>;

/** Commander config **/

const positiveInt = (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0)
    throw new InvalidOptionArgumentError("Must be a positive integer");
  return n;
};

export async function parseCli(
  argv: readonly string[]
): Promise<IngestOptions> {
  program
    .name("visual-notes-ingest")
    .option("--source <source>", "apple-notes | html-dir | notion-md")
    .option("-n, --limit <n>", "max notes", positiveInt, 10)
    .option("-v, --verbose", "verbose logs", false)
    .option("--markdown", "convert to markdown", true)
    .option("--split", "write split .md files", false)
    .option("--split-dir <path>", "output dir for split markdown")
    .option("--out-dir <path>", "output root (default: ./out)")
    .option("--jxa-raw-dir <path>", "write raw HTML to dir (apple-notes)")
    .option("--inline-json", "JXA returns inline HTML in JSON", false)
    .option("--debug-jxa", "enable extra JXA debug", false)
    .option("--jxa-stdout", "passthrough JXA stdout", false)
    .option("--allow-dummy", "fall back to dummy data on JXA failure", false)
    .option("--from-html-dir <path>", "read HTML files (html-dir)")
    .option(
      "--notion-root <path>",
      "root of Notion exported Markdown tree (notion-md)"
    )
    .option("--post", "POST to server", false)
    .option("--server-url <url>", "server base URL", "http://localhost:3000")
    .option(
      "--source-tag <name>",
      "source tag for server",
      process.env.INGEST_SOURCE ?? "local"
    )
    .option("--batch-size <n>", "POST batch size", positiveInt, 20)
    .option("--skip-index <path>", "skip-index file")
    .option("--prefetch-inventory", "prefetch remote inventory", false);

  await program.parseAsync(argv);

  const raw = program.opts();

  const parsed = CliSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.flatten();
    const details = JSON.stringify(issues, null, 2);
    console.error("[cli] invalid options:\n", details);
    throw parsed.error;
  }

  console.log("[cli] parsed options:", {
    source: parsed.data.source,
    outDir: parsed.data.outDir,
    post: parsed.data.post,
    ...(parsed.data.source === "html-dir"
      ? { fromHtmlDir: parsed.data.fromHtmlDir }
      : {}),
    ...(parsed.data.source === "notion-md"
      ? { notionRoot: parsed.data.notionRoot }
      : {}),
  });

  return parsed.data;
}

(async () => {
  let options: IngestOptions;
  try {
    options = await parseCli(process.argv);
  } catch (e) {
    process.exit(2);
  }

  const logger = createLogger(options.verbose);

  try {
    console.log("[cli] invoking pipeline…");
    await runPipeline(options, logger);
    console.log("[cli] pipeline complete");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(msg);
    process.exit(1);
  }
})();
