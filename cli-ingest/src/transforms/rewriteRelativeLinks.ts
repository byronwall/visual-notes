import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import { sanitizeId } from "../sources/notionMd";
// import type { Root, Definition, Link } from "mdast";

const ABSOLUTE_SCHEMES = new Set([
  "http",
  "https",
  "mailto",
  "tel",
  "data",
  "file",
  "blob",
  "notion",
]);

function isRelativeUrl(raw: string): boolean {
  if (!raw) return false;
  const url = raw.trim();
  if (url.startsWith("//") || url.startsWith("/") || url.startsWith("#"))
    return false;
  const colon = url.indexOf(":");
  const slash = url.indexOf("/");
  if (colon > 0 && (slash === -1 || colon < slash)) {
    const scheme = url.slice(0, colon).toLowerCase();
    if (ABSOLUTE_SCHEMES.has(scheme)) return false;
    return false;
  }
  return true;
}

function rewriteUrl(u: string, prefix = "__NOTION__"): string {
  return `${prefix}${sanitizeId(u.trim())}`;
}

export function rewriteRelativeLinks(markdown: string): string {
  if (!markdown) return markdown;

  let rewrites = 0;

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(() => (tree) => {
      visit(tree, "link", (node) => {
        const url = node.url ?? "";
        if (!isRelativeUrl(url)) return;
        node.url = rewriteUrl(url);
        rewrites++;
      });
      visit(tree, "definition", (node) => {
        const url = node.url ?? "";
        if (!isRelativeUrl(url)) return;
        node.url = rewriteUrl(url);
        rewrites++;
      });
    })
    .use(remarkStringify, {
      fences: true,
      listItemIndent: "one",
      bullet: "-",
    });

  const file = processor.processSync(markdown);
  if (rewrites > 0) {
    console.log(`[rewriteRelativeLinks] prefixed ${rewrites} relative link(s)`);
  }
  return String(file);
}
