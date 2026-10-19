const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const decodeEntities = (text: string) =>
  text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const hex = code[1] === "x" || code[1] === "X";
      const value = parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });

/**
 * Text of the H1 that opens a note's HTML, or undefined when the note starts
 * with anything else. Used to tell whether the note already shows its title
 * as its first line.
 */
export function leadingH1Text(html?: string | null): string | undefined {
  if (!html) return undefined;
  const match = html.match(/^\s*<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/i);
  if (!match) return undefined;
  const text = decodeEntities(match[1].replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

export const titlesMatch = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
