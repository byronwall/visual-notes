/**
 * True on touch-first devices, where focusing an input opens the keyboard and
 * covers most of the screen. Call it in handlers, never during render.
 */
export const isCoarsePointer = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;
