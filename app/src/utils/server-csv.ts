export function splitRefs(s: string): string[] {
  return s
    .split(/[;|,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function normalizeRef(ref: string): string {
  const r = ref
    .replace(/^ps(\.|alm)?/i, "Psalm")
    .replace(/\s*–\s*/g, "–")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return r;
}

