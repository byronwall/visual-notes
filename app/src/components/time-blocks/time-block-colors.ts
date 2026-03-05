const DEFAULT_TIME_BLOCK_COLOR = "var(--colors-blue-500)";
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
