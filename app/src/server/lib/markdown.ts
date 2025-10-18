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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineMd(text: string): string {
  // Code spans
  let t = text.replace(
    /`([^`]+)`/g,
    (_m, code) => `<code>${escapeHtml(code)}</code>`
  );
  // Links [label](href)
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
    const safeHref = escapeHtml(String(href));
    const safeLabel = String(label);
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
  });
  // Autolink bare URLs
  t = t.replace(/(?<!["'>])(https?:\/\/[^\s)]+)(?![^<]*>)/g, (_m, url) => {
    const safe = escapeHtml(String(url));
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
  });
  // Bold
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return t;
}

function markdownToHtml(md: string): string {
  const rendered = marked.parse(md, { breaks: true });
  const options: IOptions = {
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
  const sanitized = sanitizeHtml(String(rendered), options);
  return sanitized;
}

export function normalizeAiOutputToHtml(raw: string): string {
  if (!raw) return "";

  console.log("normalizeAiOutputToHtml", { raw });

  // Unwrap known wrappers first
  let s = stripAiHtmlWrapper(raw);
  s = stripCodeFences(s);

  console.log("normalizeAiOutputToHtml", { s });

  const hasMd = true;
  if (!hasMd) return markdownToHtml(s).trim();

  return markdownToHtml(s).trim();
}
