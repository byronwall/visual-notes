import { css } from "styled-system/css";

export const sectionLabelClass = css({
  fontSize: "xs",
  fontWeight: "medium",
  color: "fg.subtle",
  textTransform: "uppercase",
  letterSpacing: "wider",
  mt: "3",
  mb: "1",
});

export const cardLinkClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  w: "full",
  textAlign: "left",
  fontSize: "sm",
  color: "fg.link",
  cursor: "pointer",
  py: "0.5",
  borderRadius: "l1",
  transitionProperty: "color, background-color",
  transitionDuration: "140ms",
  _hover: { color: "fg.linkHover", bg: "gray.a2" },
});

export const textButtonClass = css({
  fontSize: "sm",
  color: "fg.link",
  cursor: "pointer",
  px: "1.5",
  h: "7",
  borderRadius: "l1",
  transitionProperty: "background-color",
  transitionDuration: "140ms",
  _hover: { bg: "gray.a3" },
  _disabled: { color: "fg.subtle", cursor: "default" },
  "&[data-tone=danger]": { color: "red.11" },
  "@media (pointer: coarse)": { h: "9" },
});
