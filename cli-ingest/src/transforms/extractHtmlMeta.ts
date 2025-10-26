import * as cheerio from "cheerio";

export type HtmlMeta = {
  id?: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  folder?: string;
};

export function extractHtmlMeta(html: string): HtmlMeta | undefined {
  try {
    // TODO: need to confirm this works with the current <script>{}</script> format.
    const $ = cheerio.load(html);
    const script = $("#visual-notes-meta").first().text();
    if (script) return JSON.parse(script);
    const title = $("title").first().text() || undefined;
    return { title };
  } catch {
    return undefined;
  }
}
