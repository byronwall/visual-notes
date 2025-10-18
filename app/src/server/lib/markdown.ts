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
  // Bold
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return t;
}

function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Skip blank lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Headings ###### to #
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = Math.min(6, h[1].length);
      out.push(
        `<h${level}>${renderInlineMd(escapeHtml(h[2].trim()))}</h${level}>`
      );
      i++;
      continue;
    }

    // Unordered list
    if (/^(?:-|\*)\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^(?:-|\*)\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^(?:-|\*)\s+/, "");
        items.push(`<li>${renderInlineMd(escapeHtml(itemText))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\d+\.\s+/, "");
        items.push(`<li>${renderInlineMd(escapeHtml(itemText))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Tables (very simple pipe-based)
    if (line.includes("|") && /^\s*\|.+\|\s*$/.test(line)) {
      const rows: string[] = [];
      const header = line;
      const next = lines[i + 1] || "";
      const isSep = /^\s*\|?\s*:?-{2,}\s*(\|\s*:?-{2,}\s*)+\|?\s*$/.test(next);
      const headerCells = header
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
      if (isSep) {
        i += 2; // skip header and separator
        const body: string[] = [];
        while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
          const cells = lines[i]
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((c) => `<td>${renderInlineMd(escapeHtml(c.trim()))}</td>`)
            .join("");
          body.push(`<tr>${cells}</tr>`);
          i++;
        }
        const thead = headerCells
          .map((c) => `<th>${renderInlineMd(escapeHtml(c))}</th>`)
          .join("");
        rows.push(`<thead><tr>${thead}</tr></thead>`);
        rows.push(`<tbody>${body.join("")}</tbody>`);
      } else {
        // Treat as paragraph if no separator row
        const para: string[] = [line];
        i++;
        while (i < lines.length && lines[i].trim()) {
          para.push(lines[i]);
          i++;
        }
        out.push(`<p>${renderInlineMd(escapeHtml(para.join(" ").trim()))}</p>`);
        continue;
      }
      out.push(`<table>${rows.join("")}</table>`);
      continue;
    }

    // Paragraph: collect until blank line
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim()) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${renderInlineMd(escapeHtml(para.join(" ").trim()))}</p>`);
  }

  return out.join("\n");
}

export function normalizeAiOutputToHtml(raw: string): string {
  if (!raw) return "";
  // Unwrap known wrappers first
  let s = stripAiHtmlWrapper(raw);
  s = stripCodeFences(s);

  const hasHtml = looksLikeHtml(s);
  const hasMd = looksLikeMarkdown(s);
  if (hasHtml && !hasMd) return s.trim();
  if (!hasHtml && hasMd) return markdownToHtml(s).trim();

  if (hasHtml && hasMd) {
    // Mixed content: convert only the non-HTML text chunks
    const tokens = s.split(/(<[^>]+>)/g);
    const converted = tokens.map((tok) => {
      if (!tok) return tok;
      if (tok.startsWith("<") && tok.endsWith(">")) return tok; // keep tags as-is
      const text = tok;
      if (!text.trim()) return text; // preserve whitespace between tags
      return markdownToHtml(text);
    });
    return converted.join("").trim();
  }

  // Fallback: wrap plain text in <p>
  const escaped = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p>${escaped}</p>`;
}
