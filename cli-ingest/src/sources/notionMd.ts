import { join, extname, basename, dirname } from "node:path";
import { statSync, readFileSync, readdirSync } from "node:fs";
import { IngestSource, IngestSourceOptions, RawNote } from "../types";

export function notionMdSource(root: string): IngestSource {
  const walk = (dir: string, acc: string[] = []) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p, acc);
      else if (extname(p).toLowerCase() === ".md") acc.push(p);
    }
    return acc;
  };

  return {
    name: "notion-md",
    async load({ limit }: IngestSourceOptions) {
      // TODO: code is highly suspect will stub in correct stuff later
      const files = walk(root);
      const slice = limit > 0 ? files.slice(0, limit) : files;
      const notes: RawNote[] = slice.map((p) => {
        const md = readFileSync(p, "utf8");
        const title = basename(p, ".md");
        const fauxHtml = `<article data-origin="notion-md"><h1>${title}</h1>\n<pre data-md>${escapeHtml(
          md
        )}</pre></article>`;
        return {
          id: p,
          title,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          folder: dirname(p),
          html: fauxHtml,
          filePath: p,
        };
      });
      return { notes, meta: { root } };
    },
  };
}

// TODO: seen this several times, create a common helper for this.
const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!)
  );
