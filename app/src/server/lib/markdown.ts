import { marked } from "marked";
import sanitizeHtml, { type IOptions } from "sanitize-html";

// Preserve fenced code blocks; do not strip them. Marked will handle them.

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
      // Allow spans for Shiki token wrappers
      "span",
    ]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title"],
      code: ["class"],
      // Shiki adds classes and inline styles on pre/span
      pre: ["class", "style"],
      span: ["class", "style"],
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

export function normalizeMarkdownToHtml(raw: string | undefined): string {
  if (!raw) return "";

  // Unwrap known wrappers first
  let s = stripAiHtmlWrapper(raw);
  // Keep fenced code blocks intact for proper rendering/highlighting

  try {
    const hasFences = /^```/m.test(s);
    const sample = s.slice(0, 200);
    console.log(
      "[markdown.normalize] input len:%d fenced:%s sample:%s",
      s.length,
      hasFences,
      sample
    );
  } catch {}

  const out = markdownToHtml(s).trim();

  try {
    const hasPre = /<pre\b[^>]*>\s*<code\b/i.test(out);
    const outSample = out.slice(0, 200);
    console.log(
      "[markdown.normalize] output len:%d preCode:%s sample:%s",
      out.length,
      hasPre,
      outSample
    );
  } catch {}

  return out;
}
