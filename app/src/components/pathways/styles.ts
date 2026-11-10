import { css } from "styled-system/css";

// Classes the pathway panels share. Card and edge styles live with the graph.

export const section = css({
  display: "flex",
  flexDirection: "column",
  gap: "2",
  p: "3",
  borderBottomWidth: "1px",
  borderColor: "border",
});

export const label = css({
  mt: "1",
  fontSize: "xs",
  fontWeight: "semibold",
  textTransform: "uppercase",
  letterSpacing: "wide",
  color: "fg.muted",
});

export const help = css({ m: "0", fontSize: "xs", color: "fg.muted" });

export const row = css({ display: "flex", alignItems: "center", gap: "2" });

/** A row of joined toggle buttons. */
export const seg = css({
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "1fr",
  "& > button": {
    h: "7",
    px: "2.5",
    fontSize: "xs",
    borderWidth: "1px",
    borderColor: "border",
    bg: "bg.default",
    color: "fg.default",
    ml: "-1px",
    cursor: "pointer",
    transition: "background-color 140ms, color 140ms",
    _hover: { bg: "bg.hover" },
    _first: { borderLeftRadius: "md", ml: "0" },
    _last: { borderRightRadius: "md" },
  },
  "& > button[data-on=true]": {
    bg: "fg.default",
    color: "bg.default",
    borderColor: "fg.default",
    _hover: { bg: "fg.default", opacity: 0.9 },
  },
  "& > button[data-on=true][data-tone=like]": {
    bg: "green.9",
    borderColor: "green.9",
    color: "white",
  },
  "& > button[data-on=true][data-tone=no]": {
    bg: "red.9",
    borderColor: "red.9",
    color: "white",
  },
  "& > button[data-on=true][data-tone=more]": {
    bg: "amber.9",
    borderColor: "amber.9",
    color: "white",
  },
});

/** Links to cards in lists: colored text, no underline. */
export const cardLink = css({
  p: "0",
  bg: "transparent",
  border: "none",
  color: "fg.link",
  textAlign: "left",
  cursor: "pointer",
  minW: "0",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  _hover: { color: "fg.linkHover" },
});

export const linkList = css({
  listStyle: "none",
  m: "0",
  p: "0",
  display: "flex",
  flexDirection: "column",
  gap: "1",
});

export const smallButton = css({
  h: "7",
  px: "2.5",
  fontSize: "xs",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "md",
  bg: "bg.default",
  color: "fg.default",
  cursor: "pointer",
  transition: "background-color 140ms",
  _hover: { bg: "bg.hover" },
  _disabled: { opacity: 0.5, cursor: "default" },
  "&[data-on=true]": {
    bg: "fg.default",
    color: "bg.default",
    borderColor: "fg.default",
    _hover: { bg: "fg.default", opacity: 0.9 },
  },
  "&[data-danger=true]": { color: "red.11" },
});

export const iconX = css({
  w: "6",
  h: "6",
  p: "0",
  border: "none",
  bg: "transparent",
  color: "fg.muted",
  cursor: "pointer",
  borderRadius: "sm",
  _hover: { bg: "bg.hover", color: "fg.default" },
});

/** A quiet text-only button for secondary actions in a label row. */
export const textButton = css({
  p: "0",
  border: "none",
  bg: "transparent",
  fontSize: "xs",
  color: "fg.link",
  cursor: "pointer",
  transition: "color 140ms",
  _hover: { color: "fg.linkHover" },
  _disabled: { opacity: 0.5, cursor: "default" },
});
