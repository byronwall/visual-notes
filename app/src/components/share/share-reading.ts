export type ShareOutlineItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

export type PreparedShareHtml = {
  html: string;
  outline: ShareOutlineItem[];
  wordCount: number;
};

const WORDS_PER_MINUTE = 220;

const decodeEntities = (value: string) =>
  value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "’");

export const htmlToText = (html: string) =>
  decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const normalizeForCompare = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const slugifyHeading = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64) || "section";

/**
 * Removes a leading <h1> that repeats the note title, since the share page
 * already renders the title as its own heading.
 */
export const stripLeadingTitleHeading = (html: string, title: string) => {
  const match = html.match(/^\s*<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) return html;
  const headingText = normalizeForCompare(htmlToText(match[1]));
  if (headingText.length === 0 || headingText !== normalizeForCompare(title)) {
    return html;
  }
  return html.slice(match[0].length);
};

/**
 * Adds stable ids to h2/h3 headings and returns an outline for the reading
 * rail. Pure string transform so server and client render identical markup.
 */
export const addHeadingAnchors = (html: string) => {
  const outline: ShareOutlineItem[] = [];
  const used = new Map<string, number>();
  const out = html.replace(
    /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (full, levelRaw: string, attrs: string, inner: string) => {
      const text = htmlToText(inner);
      if (text.length === 0 || /\sid=/i.test(attrs)) return full;
      const base = slugifyHeading(text);
      const seen = used.get(base) ?? 0;
      used.set(base, seen + 1);
      const id = seen === 0 ? base : `${base}-${seen + 1}`;
      const level = levelRaw === "2" ? 2 : 3;
      outline.push({ id, text, level });
      return `<h${levelRaw}${attrs} id="${id}">${inner}</h${levelRaw}>`;
    },
  );
  return { html: out, outline };
};

export const prepareShareHtml = (
  html: string,
  title: string,
): PreparedShareHtml => {
  const stripped = stripLeadingTitleHeading(html, title);
  const anchored = addHeadingAnchors(stripped);
  const text = htmlToText(stripped);
  const wordCount = text.length === 0 ? 0 : text.split(" ").length;
  return { html: anchored.html, outline: anchored.outline, wordCount };
};

export const readingMinutes = (wordCount: number) =>
  Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** Calendar date in UTC so server and client agree during hydration. */
export const formatShareDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return dateFormatter.format(date);
};
