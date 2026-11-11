import { css } from "styled-system/css";

/** Below this toolbar width, buttons drop their labels and search folds up. */
export const TOOLBAR_NARROW = "@container coltoolbar (max-width: 35rem)";

export const toolbarBtn = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.5",
  flexShrink: "0",
  h: "7",
  minW: "7",
  px: "2",
  borderRadius: "l2",
  color: "fg.muted",
  fontSize: "sm",
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: "color 140ms, background-color 140ms",
  _hover: { bg: "bg.muted", color: "fg.default" },
  "&[data-active]": { color: "fg.selected", bg: "bg.selected" },
  "& > svg": { flexShrink: "0" },
  [TOOLBAR_NARROW]: {
    gap: "1",
    px: "1.5",
    "& [data-label]": { display: "none" },
  },
});
