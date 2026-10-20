import type { OptionColor } from "./types";

/** Hue and saturation per option color; chips set these as CSS variables. */
export const OPTION_COLOR_HSL: Record<OptionColor, { h: number; s: number }> = {
  gray: { h: 220, s: 8 },
  brown: { h: 25, s: 30 },
  orange: { h: 28, s: 85 },
  yellow: { h: 46, s: 85 },
  green: { h: 140, s: 45 },
  blue: { h: 212, s: 70 },
  purple: { h: 268, s: 55 },
  pink: { h: 330, s: 65 },
  red: { h: 4, s: 70 },
};

export const optionColorVars = (color: OptionColor | undefined) => {
  const c = OPTION_COLOR_HSL[color ?? "gray"] ?? OPTION_COLOR_HSL.gray;
  return { "--chip-h": String(c.h), "--chip-s": `${c.s}%` } as Record<
    string,
    string
  >;
};
