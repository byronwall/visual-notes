import type { OptionColor } from "./types";

type Ink = {
  /** Display name in the color picker. */
  name: string;
  /** Solid ink: swatches and status dots. */
  ink: string;
  light: { bg: string; fg: string };
  dark: { bg: string; fg: string };
};

/**
 * Option colors as printed inks: muted, warm, and paper-toned rather than
 * saturated UI hues. Keys stay the stored color names; only the look is
 * editorial. Text on each fill clears 4.5:1 in both themes.
 */
export const OPTION_PALETTE: Record<OptionColor, Ink> = {
  gray: {
    name: "Graphite",
    ink: "#8b867e",
    light: { bg: "#ecebe7", fg: "#3b3935" },
    dark: { bg: "#34322f", fg: "#d9d5ce" },
  },
  brown: {
    name: "Walnut",
    ink: "#9a6b47",
    light: { bg: "#f0e6dc", fg: "#58391f" },
    dark: { bg: "#3a2c21", fg: "#e3cdb8" },
  },
  orange: {
    name: "Terracotta",
    ink: "#c4613a",
    light: { bg: "#f6e2d6", fg: "#843619" },
    dark: { bg: "#46271b", fg: "#f1c3ab" },
  },
  yellow: {
    name: "Ochre",
    ink: "#be952b",
    light: { bg: "#f4e9cb", fg: "#664c0c" },
    dark: { bg: "#3d3218", fg: "#ead7a0" },
  },
  green: {
    name: "Moss",
    ink: "#6a8a4c",
    light: { bg: "#e4ebdb", fg: "#384c25" },
    dark: { bg: "#2a3421", fg: "#c9dbb4" },
  },
  blue: {
    name: "Prussian",
    ink: "#3f6a94",
    light: { bg: "#dfe7ef", fg: "#1d3753" },
    dark: { bg: "#1f2d3d", fg: "#bcd0e6" },
  },
  purple: {
    name: "Plum",
    ink: "#8b5784",
    light: { bg: "#ebe1ea", fg: "#522c4c" },
    dark: { bg: "#36253a", fg: "#e0c6dc" },
  },
  pink: {
    name: "Rose",
    ink: "#bd5e6e",
    light: { bg: "#f4e1e2", fg: "#762b37" },
    dark: { bg: "#432428", fg: "#f0c2c9" },
  },
  red: {
    name: "Vermilion",
    ink: "#b5392b",
    light: { bg: "#f3dcd7", fg: "#7a1d14" },
    dark: { bg: "#47201b", fg: "#f2bbb2" },
  },
};

export const optionInk = (color: OptionColor | undefined) =>
  (OPTION_PALETTE[color ?? "gray"] ?? OPTION_PALETTE.gray).ink;

/** CSS variables a chip reads for its fill, text, and dot in both themes. */
export const optionColorVars = (color: OptionColor | undefined) => {
  const c = OPTION_PALETTE[color ?? "gray"] ?? OPTION_PALETTE.gray;
  return {
    "--chip-ink": c.ink,
    "--chip-bg": c.light.bg,
    "--chip-fg": c.light.fg,
    "--chip-bg-dark": c.dark.bg,
    "--chip-fg-dark": c.dark.fg,
  } as Record<string, string>;
};
