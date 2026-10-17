// The theme has no blue scale, so the default is a concrete HSL value.
const DEFAULT_TIME_BLOCK_COLOR = "hsl(220 52% 50%)";
const TIME_BLOCK_SATURATION = 52;
const TIME_BLOCK_LIGHTNESS = 50;

const HSL_HUE_PATTERN = /hsla?\(\s*([+-]?\d*\.?\d+)(?:deg)?(?:\s+|,\s*)/i;

const normalizeHue = (hue: number) => {
  const wrapped = hue % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
};

export const extractHueFromColor = (value: string | null | undefined) => {
  if (!value) return null;
  const match = HSL_HUE_PATTERN.exec(value.trim());
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  if (Number.isNaN(parsed)) return null;
  return normalizeHue(parsed);
};

export const createTimeBlockColorFromHue = (hue: number) =>
  `hsl(${normalizeHue(hue)} ${TIME_BLOCK_SATURATION}% ${TIME_BLOCK_LIGHTNESS}%)`;

export const randomTimeBlockColor = () =>
  createTimeBlockColorFromHue(Math.floor(Math.random() * 360));

export const normalizeTimeBlockColor = (
  value: string | null | undefined,
  fallback = DEFAULT_TIME_BLOCK_COLOR,
) => {
  if (!value) return fallback;
  const hue = extractHueFromColor(value);
  if (hue === null) return value;
  return createTimeBlockColorFromHue(hue);
};

const parseRgb = (value: string): [number, number, number] | null => {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (hex) {
    const raw = hex[1].length === 3 ? hex[1].replace(/./g, "$&$&") : hex[1];
    return [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16) / 255) as [
      number,
      number,
      number,
    ];
  }
  const hsl = /hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i.exec(
    value,
  );
  if (!hsl) return null;
  const [h, s, l] = [
    Number(hsl[1]),
    Number(hsl[2]) / 100,
    Number(hsl[3]) / 100,
  ];
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
};

const luminance = ([r, g, b]: [number, number, number]) => {
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const DARK_TEXT = "rgba(0, 0, 0, 0.82)";
const DARK_TEXT_LUMINANCE = 0;

const contrastRatio = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * White or near-black text, whichever reads better on the fill. Mid-tone
 * oranges, cyans, greens and yellows get dark text; blues, purples and reds
 * keep white. Render-only: stored colors are untouched.
 */
export const readableTextColor = (background: string) => {
  const rgb = parseRgb(background);
  if (!rgb) return "white";
  const fill = luminance(rgb);
  return contrastRatio(fill, DARK_TEXT_LUMINANCE) > contrastRatio(fill, 1)
    ? DARK_TEXT
    : "white";
};
