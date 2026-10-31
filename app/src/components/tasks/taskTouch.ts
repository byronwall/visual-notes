/** Phones and touch tablets act on tasks through the action sheet. */
export const usesTaskSheet = () =>
  window.matchMedia("(pointer: coarse), (max-width: 47.99em)").matches;
