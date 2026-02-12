import { marked } from "marked";
import sanitizeHtml, { type IOptions } from "sanitize-html";

// Preserve fenced code blocks; do not strip them. Marked will handle them.

function stripAiHtmlWrapper(input: string): string {
  const m = input.match(
    /<div[^>]*class=["']ai-html["'][^>]*>([\s\S]*?)<\/div>/i
  );
  return m ? m[1].trim() : input;
}

function removeUtmParamsFromUrl(input: string): string {
  if (!input) return input;
  // If we ever receive an HTML-escaped URL (e.g. from previously-sanitized HTML),
  // normalize it before parsing so `URLSearchParams` doesn't treat `amp;foo` as a key.
  const normalizedInput = input
    .replaceAll("&amp;", "&")
    .replaceAll("&#38;", "&")
    .replaceAll("&#x26;", "&");

  // Some previously-saved content may contain the same absolute URL accidentally
  // concatenated multiple times (e.g. `https://x?...https://x?...`). Try to recover
  // a single valid URL instead of failing parsing and preserving the broken string.
  const secondHttpIdx = normalizedInput.slice(1).search(/https?:\/\//i);
  if (secondHttpIdx !== -1) {
    const splitIdx = secondHttpIdx + 1;
    const first = normalizedInput.slice(0, splitIdx);
    // If the first chunk is a valid absolute URL, prefer it.
    if (/^https?:\/\//i.test(first)) {
      return removeUtmParamsFromUrl(first);
    }
  }

  const isProtocolRelative = /^\/\//.test(input);
  const hasHttpProtocol = /^https?:\/\//i.test(input);
  if (!isProtocolRelative && !hasHttpProtocol) return input;

  try {
    const urlForParse = isProtocolRelative
      ? `https:${normalizedInput}`
      : normalizedInput;
    const urlObj = new URL(urlForParse);

    const toDelete: string[] = [];
    urlObj.searchParams.forEach((_v, k) => {
      if (/^utm_/i.test(k)) toDelete.push(k);
    });

    toDelete.forEach((k) => urlObj.searchParams.delete(k));

    const out = urlObj.toString();
    const finalOut = isProtocolRelative ? out.replace(/^https?:/, "") : out;
    return finalOut;
  } catch (err) {
    return input;
  }
}

function fixConcatenatedUrlsInText(text: string): string {
  // Find "word-like" URL runs (up to whitespace or a tag boundary). If a run contains
  // multiple absolute/protocol-relative URL starts, split and collapse duplicates.
  const urlRunPattern = /(?:https?:\/\/|\/\/)[^\s<]+/gi;
  return text.replace(urlRunPattern, (run) => {
    // Only split on *new* absolute URL starts. Do NOT split on bare `//` or we'll
    // break normal `https://` into `https:` + `//...`.
    const parts = run
      .split(/(?=https?:\/\/)/i)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length <= 1) return removeUtmParamsFromUrl(run);

    const cleaned = parts.map((p) => removeUtmParamsFromUrl(p));
    const deduped: string[] = [];
    for (const c of cleaned) {
      if (deduped.length === 0 || deduped[deduped.length - 1] !== c) {
        deduped.push(c);
      }
    }

    // Most common case: same link repeated many times with no separator → collapse.
    const allSame = deduped.every((u) => u === deduped[0]);
    if (allSame) return deduped[0] || run;

    // If they were different URLs but concatenated, at least make them readable.
    return deduped.join(" ");
  });
}

function escapeHtmlText(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
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
      a: (tagName: string, attribs: Record<string, string>) => {
        let href = attribs.href || "";
        try {
          href = removeUtmParamsFromUrl(href);
        } catch {}
        return {
          tagName: "a",
          attribs: {
            ...attribs,
            href,
            target: attribs.target || "_blank",
            rel: attribs.rel || "noopener noreferrer",
          },
        };
      },
    },
    textFilter: (text: string) => {
      // Repair "crazy" concatenated links and strip utm_* params in any URL-like text.
      return fixConcatenatedUrlsInText(text);
    },
  };
}

export function sanitizeHtmlContent(html: string): string {
  const options = getSanitizeOptions();
  const sanitized = sanitizeHtml(String(html), options);

  // Post-pass: In some "crazy link" cases coming from markdown autolinking,
  // `sanitize-html` correctly fixes the href but leaves anchor text containing
  // multiple concatenated absolute URLs. Collapse those runs for readability.
  const fixedAnchors = sanitized.replace(
    /(<a\b[^>]*>)([^<]*)(<\/a>)/gi,
    (_m, open: string, text: string, close: string) => {
      const httpCount = (text.match(/https?:\/\//gi) || []).length;
      if (httpCount < 2) return `${open}${text}${close}`;

      const fixedText = fixConcatenatedUrlsInText(text);
      if (fixedText === text) return `${open}${text}${close}`;

      return `${open}${escapeHtmlText(fixedText)}${close}`;
    }
  );

  return fixedAnchors;
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

  const out = markdownToHtml(s).trim();

  return out;
}
