import { program, InvalidOptionArgumentError } from "commander";
import { z } from "zod";
import { runPipeline } from "./pipeline";
import { createLogger } from "./logger";

const positiveInt = (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0)
    throw new InvalidOptionArgumentError("Must be a positive integer");
  return n;
};

const cliSchema = z.object({
  source: z.enum(["apple-notes", "html-dir", "notion-md"]),
  limit: z.number().int().positive().default(10),
  verbose: z.boolean().default(false),
  markdown: z.boolean().default(true),
  split: z.boolean().default(false),
  splitDir: z.string().optional(),
  outDir: z.string().optional(),
  jxaRawDir: z.string().optional(),
  inlineJson: z.boolean().default(false),
  debugJxa: z.boolean().default(false),
  jxaStdout: z.boolean().default(false),
  allowDummy: z.boolean().default(false),
  fromHtmlDir: z.string().optional(),
  notionRoot: z.string().optional(),
  post: z.boolean().default(false),
  serverUrl: z.string().url().default("http://localhost:3000"),
  sourceTag: z.string().default(process.env.INGEST_SOURCE ?? "local"),
  batchSize: z.number().int().positive().default(20),
  skipIndex: z.string().optional(),
  prefetchInventory: z.boolean().default(false),
});

// TODO: create + export a global options object that carries the CLI options.

program
  .name("visual-notes-ingest")
  .allowUnknownOption(false)
  .requiredOption("--source <source>", "apple-notes | html-dir | notion-md")
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
  .option("--from-html-dir <path>", "read HTML files")
  .option("--notion-root <path>", "root of Notion exported Markdown tree")
  .option("--post", "POST to server", false)
  .option("--server-url <url>", "server base URL", "http://localhost:3000")
  .option(
    "--source-tag <name>",
    "source tag for server",
    process.env.INGEST_SOURCE ?? "local"
  )
  .option("--batch-size <n>", "POST batch size", positiveInt, 20)
  .option("--skip-index <path>", "skip-index file")
  .option("--prefetch-inventory", "prefetch remote inventory", false)
  .action(async (opts: any) => {
    const logger = createLogger(Boolean(opts.verbose));
    const parsed = cliSchema.safeParse({
      ...opts,
      serverUrl: opts.serverUrl,
      sourceTag: opts.sourceTag,
      batchSize: Number(opts.batchSize),
      limit: Number(opts.limit),
    });
    if (!parsed.success) {
      logger.error("Invalid CLI options:", parsed.error.flatten());
      process.exit(2);
    }
    try {
      // TODO: get some stronger types here
      await runPipeline(parsed.data, logger);
    } catch (e) {
      logger.error((e as Error).message);
      process.exit(1);
    }
  });

// TODO: what does this do?
program.parseAsync(process.argv).catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(msg);
  process.exit(1);
});
