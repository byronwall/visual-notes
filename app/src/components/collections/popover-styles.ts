import { css } from "styled-system/css";

/** Popover content sized by its panel instead of the recipe's fixed width. */
export const fitContent = css({
  width: "auto !important",
  maxW: "calc(100vw - 1rem)",
  p: "0",
  overflow: "auto",
});
