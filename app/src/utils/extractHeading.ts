export function extractFirstH1FromMarkdown(
  markdown?: string
): string | undefined {
  if (!markdown) return undefined;
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^#\s+(.+?)\s*$/);
    if (m) {
      return m[1].trim();
    }
    // Stop scanning if we hit non-empty content before first heading
    if (line.trim().length > 0 && !line.startsWith("#")) break;
  }
  return undefined;
}

export function extractFirstH1FromHtml(html?: string): string | undefined {
  if (!html) return undefined;
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return undefined;
  const inner = m[1] || "";
  const text = inner
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

export function extractFirstHeading(input: {
  markdown?: string;
  html?: string;
}): string | undefined {
  const m = extractFirstH1FromMarkdown(input.markdown);
  if (m) return m;
  return extractFirstH1FromHtml(input.html);
}
