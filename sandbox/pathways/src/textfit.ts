// Largest font size at which a title, wrapped at word breaks, fits a box.
// Measures with a canvas in the card's real font, so the fill is tight.

const FAMILY = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const LINE = 1.2;
let ctx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();

function lineCount(text: string, size: number, width: number, weight: number) {
  ctx ??= document.createElement("canvas").getContext("2d")!;
  ctx.font = `${weight} ${size}px ${FAMILY}`;
  const space = ctx.measureText(" ").width;
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = ctx.measureText(word).width;
    if (w > width) {
      // A word wider than the box breaks across lines.
      lines += used ? 1 : 0;
      lines += Math.ceil(w / width) - 1;
      used = w % width;
      continue;
    }
    if (used && used + space + w > width) {
      lines++;
      used = w;
    } else used += (used ? space : 0) + w;
  }
  return lines;
}

/** Largest size in px (to 0.5px) whose wrapped lines fit width x height. */
export function fitText(text: string, width: number, height: number, weight = 600, max = 120) {
  const key = `${text}|${Math.round(width)}|${Math.round(height)}|${weight}|${max}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let lo = 4;
  let hi = Math.max(lo, Math.min(max, height / LINE));
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    if (lineCount(text, mid, width, weight) * mid * LINE <= height) lo = mid;
    else hi = mid;
  }
  if (cache.size > 2000) cache.clear();
  cache.set(key, lo);
  return lo;
}
