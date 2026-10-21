import type { Bounds } from "../labels/label-geometry";

/**
 * Muted hues for region shapes. Neighbors get different hues so two
 * touching regions read as two topics, not one smear.
 */
const REGION_HUES = [214, 162, 32, 268, 346, 92, 190];

export type RegionTone = {
  hue: number;
  /** Shape fill, stroke, and the tint dots take at overview zoom. */
  fill: string;
  stroke: string;
  dot: string;
};

export function regionTone(hue: number): RegionTone {
  return {
    hue,
    fill: `hsl(${hue} 70% 55%)`,
    stroke: `hsl(${hue} 45% 42%)`,
    dot: `hsl(${hue} 38% 46%)`,
  };
}

function boundsGap(a: Bounds, b: Bounds) {
  const dx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX);
  const dy = Math.max(0, a.minY - b.maxY, b.minY - a.maxY);
  return Math.hypot(dx, dy);
}

/**
 * Greedy graph coloring: regions in input order take the first hue no
 * nearby region already holds. Depends only on the shapes, so colors hold
 * across zoom, pan, and reloads.
 */
export function assignRegionTones(
  shapes: Array<{ regionId: string; bounds: Bounds }>,
) {
  const tones = new Map<string, RegionTone>();
  const hueIndex = new Map<string, number>();
  for (const [index, shape] of shapes.entries()) {
    const size = Math.max(
      shape.bounds.maxX - shape.bounds.minX,
      shape.bounds.maxY - shape.bounds.minY,
    );
    const taken = new Set<number>();
    for (const other of shapes.slice(0, index)) {
      if (boundsGap(shape.bounds, other.bounds) < size * 0.5) {
        taken.add(hueIndex.get(other.regionId)!);
      }
    }
    let pick = 0;
    while (taken.has(pick) && pick < REGION_HUES.length - 1) pick++;
    if (taken.has(pick)) pick = index % REGION_HUES.length;
    hueIndex.set(shape.regionId, pick);
    tones.set(shape.regionId, regionTone(REGION_HUES[pick]!));
  }
  return tones;
}

type Rgb = [number, number, number];

const HSL_PATTERN = /hsla?\(\s*([-\d.]+)\s*,?\s*([\d.]+)%\s*,?\s*([\d.]+)%/;
const rgbCache = new Map<string, Rgb | null>();

function parseHsl(color: string): Rgb | null {
  const cached = rgbCache.get(color);
  if (cached !== undefined) return cached;
  const match = HSL_PATTERN.exec(color);
  let rgb: Rgb | null = null;
  if (match) {
    const h = (((Number(match[1]) % 360) + 360) % 360) / 360;
    const s = Number(match[2]) / 100;
    const l = Number(match[3]) / 100;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t: number) => {
      const k = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
      if (k < 1 / 6) return p + (q - p) * 6 * k;
      if (k < 1 / 2) return q;
      if (k < 2 / 3) return p + (q - p) * (2 / 3 - k) * 6;
      return p;
    };
    rgb = [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)].map((v) =>
      Math.round(v * 255),
    ) as Rgb;
  }
  rgbCache.set(color, rgb);
  return rgb;
}

/** `from` mixed toward `to` by `amount` (0–1). Both are `hsl()` strings. */
export function mixHslColors(from: string, to: string, amount: number) {
  if (amount <= 0) return from;
  if (amount >= 1) return to;
  const a = parseHsl(from);
  const b = parseHsl(to);
  if (!a || !b) return amount < 0.5 ? from : to;
  const mixed = a.map((v, i) => Math.round(v + (b[i]! - v) * amount));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}
