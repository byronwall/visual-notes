import { marked } from "marked";
import sanitizeHtml, { type IOptions } from "sanitize-html";

function stripCodeFences(input: string): string {
  let s = (input || "").trim();
  // Unwrap ```lang\n...\n``` fences
  if (/^```/.test(s)) {
    s = s.replace(/^```[a-zA-Z0-9_-]*\s*/i, "");
    s = s.replace(/\s*```\s*$/i, "");
  }
  // Remove any stray fences left inside
  s = s.replace(/```[a-zA-Z0-9_-]*/g, "").replace(/```/g, "");
  return s.trim();
}

function stripAiHtmlWrapper(input: string): string {
  const m = input.match(
    /<div[^>]*class=["']ai-html["'][^>]*>([\s\S]*?)<\/div>/i
  );
  return m ? m[1].trim() : input;
}

export function looksLikeHtml(input: string): boolean {
  const s = input.trim();
  if (!s) return false;
  // If it contains any HTML tag-looking pattern, assume HTML
  return /<\w+[\s>]/.test(s) || /<\/(\w+)>/.test(s);
}

export function looksLikeMarkdown(input: string): boolean {
  const s = input.trim();
  if (!s) return false;
  // Headings (explicit request: detect ###)
  if (/^###\s+/m.test(s) || /^##\s+/m.test(s) || /^#\s+/m.test(s)) return true;
  // Lists
  if (/^(?:\-|\*)\s+/m.test(s)) return true;
  // Numbered lists
  if (/^\d+\.\s+/m.test(s)) return true;
  // Fenced blocks
  if (/^```/m.test(s)) return true;
  // Markdown table pipes (common in model output)
  if (/^\s*\|[^\n]+\|\s*$/m.test(s)) return true;
  return false;
}

export function getSanitizeOptions(): IOptions {
  // Centralized sanitize-html options used across the app
  return {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "h1",
      "h2",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "code",
      "pre",
    ]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title"],
      code: ["class"],
    },
    // Allow data: URLs for images so base64-embedded images are preserved
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
    },
    transformTags: {
      a: (tagName: string, attribs: Record<string, string>) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          target: attribs.target || "_blank",
          rel: attribs.rel || "noopener noreferrer",
        },
      }),
    },
  };
}

export function sanitizeHtmlContent(html: string): string {
  const options = getSanitizeOptions();
  const sanitized = sanitizeHtml(String(html), options);

  return sanitized;
}

function markdownToHtml(md: string): string {
  const rendered = marked.parse(md, { breaks: true });
  const sanitized = sanitizeHtmlContent(String(rendered));
  return sanitized;
}

export function normalizeAiOutputToHtml(raw: string): string {
  if (!raw) return "";

  // Unwrap known wrappers first
  let s = stripAiHtmlWrapper(raw);
  s = stripCodeFences(s);

  const hasMd = true;
  if (!hasMd) return markdownToHtml(s).trim();

  try {
    const mdImgInline = (s.match(/!\[[^\]]*\]\([^)]*\)/g) || []).length;
    const htmlImgTags = (s.match(/<img\b/gi) || []).length;
    const dataImgs = (
      s.match(
        /(?:!\[[^\]]*\]\(data:[^)]+\))|(<img[^>]*src=["']data:[^"']+["'][^>]*>)/gi
      ) || []
    ).length;

    // Preview a couple of data:image URLs if present
    const mdData: string[] = [];
    const mdRe = /!\[[^\]]*\]\((data:[^)]+)\)/gi;
    let m: RegExpExecArray | null;
    while ((m = mdRe.exec(s)) && mdData.length < 2) mdData.push(m[1]);
    const htmlData: string[] = [];
    const htmlRe = /<img[^>]*src=["'](data:[^"']+)["'][^>]*>/gi;
    let h: RegExpExecArray | null;
    while ((h = htmlRe.exec(s)) && htmlData.length < 2) htmlData.push(h[1]);
    const previews = [...mdData, ...htmlData].slice(0, 2).map((u) => {
      const head = u.slice(0, 80);
      return `${head}${u.length > 80 ? "…" : ""}`;
    });
    if (previews.length) console.log("[markdown.normalize.data]", previews);
  } catch {}

  const out = markdownToHtml(s).trim();

  return out;
}
