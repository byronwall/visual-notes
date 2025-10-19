export type CodeblockPolicy = "stub" | "keep-first-20-lines" | "full";

export type PreprocessFlags = {
  PREPROCESS_STRIP_DATA_URIS?: boolean;
  PREPROCESS_MARKDOWN_TO_PLAIN?: boolean;
  PREPROCESS_STRIP_BARE_URLS?: boolean;
  PREPROCESS_CODEBLOCK_POLICY?: CodeblockPolicy;
  PREPROCESS_NORMALIZE_WHITESPACE?: boolean;
  PREPROCESS_KEEP_OUTLINE?: boolean;
};

const DEFAULT_FLAGS: Required<PreprocessFlags> = {
  PREPROCESS_STRIP_DATA_URIS: true,
  PREPROCESS_MARKDOWN_TO_PLAIN: true,
  PREPROCESS_STRIP_BARE_URLS: true,
  PREPROCESS_CODEBLOCK_POLICY: "stub",
  PREPROCESS_NORMALIZE_WHITESPACE: true,
  PREPROCESS_KEEP_OUTLINE: true,
};

export type Section = {
  headingPath: string[];
  text: string;
};

function stripDataUris(md: string): string {
  return (
    md
      // ![alt](data:...)
      .replace(/!\[[^\]]*\]\(data:[^)]+\)/gi, (m) => {
        const alt = (m.match(/!\[([^\]]*)\]/i)?.[1] || "image").trim();
        return `[image: ${alt}]`;
      })
      // <img src="data:..." alt="...">
      .replace(/<img[^>]*src=["']data:[^"']+["'][^>]*>/gi, (m) => {
        const alt = m.match(/alt=["']([^"']*)["']/i)?.[1] || "image";
        return `[image: ${alt}]`;
      })
  );
}

function stripBareUrls(md: string): string {
  // Keep link text for [text](url), but drop naked URLs
  return md.replace(
    /(?<!\]\()(?<!href=")\bhttps?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+/gi,
    ""
  );
}

function applyCodeblockPolicy(md: string, policy: CodeblockPolicy): string {
  if (policy === "full") return md;
  const fencedBlock = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)\n```/g;
  return md.replace(fencedBlock, (_m, lang, body) => {
    const l = String(lang || "").trim() || "code";
    if (policy === "stub") return `[code block: ${l}]`;
    const lines = String(body || "")
      .split(/\r?\n/)
      .slice(0, 20)
      .join("\n");
    return "```" + l + "\n" + lines + "\n```";
  });
}

function normalizeWhitespace(text: string): string {
  let s = text.replace(/[\t ]+/g, " ");
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.trim();
  // Normalize common bullet symbols
  s = s.replace(/^\s*[\-*•]\s+/gm, "- ");
  return s;
}

// Very light MD to plain conversion: keep headings, bullets, link text and hostname
function markdownToPlain(md: string): string {
  let s = md;
  // Links: [label](url) -> label (hostname)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_m, label, url) => {
    try {
      const u = new URL(String(url));
      const host = u.hostname.replace(/^www\./, "");
      return `${label} (${host})`;
    } catch {
      return String(label);
    }
  });
  // Images: ![alt](src) -> [image: alt]
  s = s.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_m, alt) => `[image: ${alt || "image"}]`
  );
  // Inline code: `x` -> x
  s = s.replace(/`([^`]+)`/g, (_m, code) => String(code));
  // Fences -> keep body already handled by codeblock policy
  s = s.replace(/```[\s\S]*?```/g, (m) => m);
  // Strip remaining MD syntax markers
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  s = s.replace(/^\s*>\s?/gm, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/^\s*(\d+)\.\s+/gm, "$1. ");
  s = s.replace(/\|/g, " ");
  return s;
}

// Parse headings and produce sections with path context
function splitByHeadings(md: string): Section[] {
  const lines = md.split(/\r?\n/);
  const path: string[] = [];
  const sections: Section[] = [];
  let buf: string[] = [];
  let bufPath: string[] = [];

  function flush() {
    const text = buf.join("\n").trim();
    if (text) sections.push({ headingPath: [...bufPath], text });
    buf = [];
  }

  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flush();
      const level = h[1].length;
      const title = h[2].trim();
      path.splice(level - 1);
      path[level - 1] = title;
      bufPath = path.slice(0, 3); // keep H1→H3
      continue;
    }
    buf.push(line);
  }
  flush();
  if (sections.length === 0) return [{ headingPath: [], text: md.trim() }];
  return sections;
}

export function preprocessMarkdown(
  md: string,
  flags?: PreprocessFlags
): Section[] {
  const cfg = { ...DEFAULT_FLAGS, ...(flags || {}) };
  let s = md || "";
  if (cfg.PREPROCESS_STRIP_DATA_URIS) s = stripDataUris(s);
  s = applyCodeblockPolicy(s, cfg.PREPROCESS_CODEBLOCK_POLICY);
  if (cfg.PREPROCESS_STRIP_BARE_URLS) s = stripBareUrls(s);
  if (cfg.PREPROCESS_MARKDOWN_TO_PLAIN) s = markdownToPlain(s);
  if (cfg.PREPROCESS_NORMALIZE_WHITESPACE) s = normalizeWhitespace(s);
  const sections = splitByHeadings(s);
  if (!cfg.PREPROCESS_KEEP_OUTLINE)
    return sections.map((sec) => ({ headingPath: [], text: sec.text }));
  return sections;
}
