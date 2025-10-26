import { execa } from "execa";
import { IngestSource, RawNote, SkipLog, IngestSourceOptions } from "../types";
import { globalCliOptions, logger } from "../cli";
import { join } from "node:path";

export function appleNotesSource(
  scriptPath: string,
  knownIdsPath: string | undefined
): IngestSource {
  const args = globalCliOptions;
  logger.info(`[ingest] resolving apple-notes source`);
  return {
    name: "apple-notes",
    async load({ limit }: IngestSourceOptions) {
      const env = {
        LIMIT: String(limit),
        // TODO: need to mkdir if nor around
        HTML_OUT_DIR: join(args.outDir, "notes-html"),
        ...(args.inlineJson ? { INLINE_HTML: "1" } : {}),
        ...(knownIdsPath ? { KNOWN_IDS_PATH: knownIdsPath } : {}),
        ...(args.debugJxa ? { JXA_DEBUG: "1" } : {}),
      } as Record<string, string>;

      logger.info(
        `[ingest] executing apple-notes source with env=${JSON.stringify(env)}`
      );

      const child = execa(
        "/usr/bin/osascript",
        ["-l", "JavaScript", scriptPath],
        { env }
      );
      const skipLogs: SkipLog[] = [];

      if (args.jxaStdout) {
        child.stderr?.on("data", (buf: Buffer) => {
          logger.info(`[ingest] JXA stderr: ${buf.toString("utf8")}`);
        });

        child.stdout?.on("data", (buf: Buffer) => {
          logger.info(`[ingest] JXA stdout: ${buf.toString("utf8")}`);
        });
      }

      let raw: string;
      try {
        logger.info(`[ingest] waiting for JXA script to complete`);
        const { stdout } = await child;
        logger.info(`[ingest] JXA script completed`);
        raw = stdout;
      } catch (e) {
        throw new Error(`osascript failed: ${(e as Error).message}`);
      }

      // TODO: get rid of parsing the output of the JXA script
      // TODO: assume it works and get on to processing the HTML files
      const parsed = JSON.parse(raw);
      const notes: RawNote[] = Array.isArray(parsed)
        ? parsed
        : parsed?.notes ?? [];
      const meta = Array.isArray(parsed) ? undefined : parsed;
      return { notes, meta, skipLogs };
    },
  };
}
