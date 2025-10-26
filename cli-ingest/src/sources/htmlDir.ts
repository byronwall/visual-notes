import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { IngestSource, IngestSourceOptions, RawNote } from "../types";
import { extractHtmlMeta } from "../transforms/extractHtmlMeta";

export function htmlDirSource(dir: string): IngestSource {
  // TODO: should probably be a class that implements IngestSource.
  return {
    name: "html-dir",
    async load({ limit }: IngestSourceOptions) {
      const files = readdirSync(dir).filter((f) =>
        f.toLowerCase().endsWith(".html")
      );
      const slice = limit > 0 ? files.slice(0, limit) : files;
      const notes: RawNote[] = [];
      for (const f of slice) {
        const filePath = join(dir, f);
        const html = readFileSync(filePath, "utf8");
        const meta = extractHtmlMeta(html);
        notes.push({
          id: meta?.id ?? f,
          title: meta?.title ?? "",
          createdAt: meta?.createdAt ?? new Date(0).toISOString(),
          updatedAt: meta?.updatedAt ?? new Date(0).toISOString(),
          folder: meta?.folder ?? "",
          filePath,
          html,
        });
      }
      return { notes };
    },
  };
}
