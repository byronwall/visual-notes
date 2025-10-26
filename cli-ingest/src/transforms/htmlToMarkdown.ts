import TurndownService from "turndown";

const td = new TurndownService();

export function htmlToMarkdown(html: string): string {
  // TODO: determine what this is for and if it's still needed.
  if (html.includes("data-md")) {
    const match = html.match(/<pre[^>]*data-md[^>]*>([\s\S]*?)<\/pre>/i);
    if (match) return decodeHtmlEntities(match[1]);
  }
  return td.turndown(html);
}

function decodeHtmlEntities(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
}
