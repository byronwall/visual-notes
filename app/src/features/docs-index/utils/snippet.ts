// Search snippets often open with the note title, which the row already shows.
export function stripLeadingTitle(
  snippet: string | null | undefined,
  title: string,
): string {
  const text = (snippet ?? "").trim();
  const t = title.trim();
  if (!text || !t) return text;
  if (text.toLowerCase().startsWith(t.toLowerCase())) {
    return text.slice(t.length).replace(/^[\s:—–-]+/, "");
  }
  return text;
}
