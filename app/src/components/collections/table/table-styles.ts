import { css } from "styled-system/css";
import { SELECT_COLUMN } from "./useColumns";

// Shared by the header, body, and footer rows of the table grid.

/** The checkbox and name columns stay put while the table scrolls sideways. */
export const stickySelect = css({ position: "sticky", left: "0", zIndex: "1" });
export const stickyTitle = css({
  position: "sticky",
  zIndex: "1",
  boxShadow: "1px 0 0 token(colors.border)",
});
export const stickyTitleStyle = { left: `${SELECT_COLUMN}px` };

export const selectCell = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});
/** A 32px-wide label around each checkbox gives it a touch-sized target. */
export const selectHit = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  w: "full",
  h: "full",
  minH: "6",
  cursor: "pointer",
});
export const selectBox = css({
  cursor: "pointer",
  accentColor: "currentColor",
  transition: "opacity 140ms",
});
