import TurndownService from "turndown";

const td = new TurndownService();

export function htmlToMarkdown(html: string): string {
  // TODO: determine what this is for and if it's still needed.
  if (html.includes("data-md")) {
    const match = html.match(/<pre[^>]*data-md[^>]*>([\s\S]*?)<\/pre>/i);
    if (match) {
      const md = decodeHtmlEntities(match[1]);
      console.log(
        `[htmlToMarkdown] using embedded markdown (len=${md.length})`
      );
      return md;
    }
  }
  const out = td.turndown(html);
  console.log(`[htmlToMarkdown] turndown produced (len=${out.length})`);
  return out;
}

function decodeHtmlEntities(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
}
