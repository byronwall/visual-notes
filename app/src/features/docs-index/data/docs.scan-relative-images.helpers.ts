import { marked } from "marked";

function isRelativeUrl(u: string): boolean {
  const url = u.trim();
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith("data:")) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) return false;
  return true;
}

function hasRelativeImageInMarkdown(markdown: string | null | undefined): boolean {
  if (!markdown || !markdown.trim()) return false;
  try {
    const tokens = marked.lexer(markdown);
    const stack: any[] = Array.isArray(tokens) ? [...tokens] : [];
    while (stack.length > 0) {
      const tok: any = stack.pop();
      if (!tok) continue;
      if (tok.type === "image" && typeof tok.href === "string") {
        if (isRelativeUrl(tok.href)) return true;
      }
      if (tok.tokens && Array.isArray(tok.tokens)) {
        for (const t of tok.tokens) stack.push(t);
      }
      if (Array.isArray(tok.items)) {
        for (const it of tok.items) {
          if (it.tokens && Array.isArray(it.tokens)) {
            for (const t of it.tokens) stack.push(t);
          }
        }
      }
      if (Array.isArray(tok.children)) {
        for (const c of tok.children) stack.push(c);
      }
    }
  } catch (e) {
    console.log(
      "[docs.scan-relative-images] markdown parse failed:",
      e instanceof Error ? e.message : String(e)
    );
  }
  return false;
}

export { hasRelativeImageInMarkdown };
