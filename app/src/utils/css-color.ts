/**
 * Reads a theme color (for example `--colors-blue-9`) for 2D canvas drawing,
 * which cannot take CSS variables. Read at draw time so dark mode applies.
 */
export function readCssColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}
