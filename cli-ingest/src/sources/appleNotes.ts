import { execa } from "execa";
import { IngestSource, RawNote, SkipLog, IngestSourceOptions } from "../types";

export function appleNotesSource(args: {
  scriptPath: string;
  jxaRawDir?: string;
  inlineJson?: boolean;
  debugJxa?: boolean;
  jxaStdout?: boolean;
  allowDummy?: boolean;
  knownIdsPath?: string;
}): IngestSource {
  return {
    name: "apple-notes",
    async load({ limit }: IngestSourceOptions) {
      const env = {
        LIMIT: String(limit),
        ...(args.jxaRawDir ? { HTML_OUT_DIR: args.jxaRawDir } : {}),
        ...(args.inlineJson ? { INLINE_HTML: "1" } : {}),
        ...(args.knownIdsPath ? { KNOWN_IDS_PATH: args.knownIdsPath } : {}),
        ...(args.debugJxa ? { JXA_DEBUG: "1" } : {}),
      } as Record<string, string>;

      const child = execa(
        "/usr/bin/osascript",
        ["-l", "JavaScript", args.scriptPath],
        { env }
      );
      const skipLogs: SkipLog[] = [];

      child.stderr?.on("data", (buf: Buffer) => {
        const lines = buf.toString("utf8").split("\n");
        for (const line of lines) {
          if (line.startsWith("[JXA][skip] ")) {
            try {
              skipLogs.push(JSON.parse(line.slice(11)));
            } catch {
              // ignore
            }
          }
        }
      });

      if (args.jxaStdout) child.stdout?.pipe(process.stdout);

      let raw: string;
      try {
        const { stdout } = await child;
        raw = stdout;
      } catch (e) {
        // TODO: remove this allowDummy fallback - it's not a good idea.
        if (!args.allowDummy)
          throw new Error(`osascript failed: ${(e as Error).message}`);
        raw = JSON.stringify([
          {
            id: "sample-1",
            title: "Sample Note",
            createdAt: new Date("2024-01-01T12:00:00Z").toISOString(),
            updatedAt: new Date("2024-01-02T12:00:00Z").toISOString(),
            folder: "Samples",
            html: "<h1>Hello</h1><p>Sample</p>",
          } satisfies RawNote,
        ]);
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
