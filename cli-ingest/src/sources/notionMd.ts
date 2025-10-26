import { join, extname, basename, dirname } from "node:path";
import { statSync, readFileSync, readdirSync } from "node:fs";
import { IngestSource, IngestSourceOptions, RawNote } from "../types";
import { rewriteRelativeLinks } from "../transforms/rewriteRelativeLinks";

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
    async load({}: IngestSourceOptions) {
      const files = walk(root);

      const notes: RawNote[] = files.map((p) => {
        console.log("[notionMdSource.load] reading file:", p);
        const md = readFileSync(p, "utf8");
        const mdRewritten = rewriteRelativeLinks(md);
        const title = basename(p, ".md");
        const fauxHtml = `<article data-origin="notion-md"><h1>${title}</h1>\n<pre data-md>${escapeHtml(
          mdRewritten
        )}</pre></article>`;

        const fullPathRelativeToNotionRoot = p.replace(root, "");
        const id = fullPathRelativeToNotionRoot.replace(
          extname(fullPathRelativeToNotionRoot),
          ""
        );

        return {
          id,
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
