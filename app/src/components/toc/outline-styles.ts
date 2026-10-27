import { css } from "styled-system/css";

export const outlineClass = css({
  display: "flex",
  flexDirection: "column",
  minH: "0",
  gap: "0.5",
  animation: "fade-in 160ms ease-out",
  _motionReduce: { animation: "none" },
});

export const filterClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  flexShrink: 0,
  h: "8",
  px: "2",
  borderRadius: "l2",
  color: "fg.subtle",
  cursor: "text",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "bg.hover", color: "fg.muted" },
  _focusWithin: { bg: "bg.hover", color: "fg.muted" },
});

export const inputClass = css({
  flex: "1",
  minW: "0",
  h: "full",
  bg: "transparent",
  border: "none",
  outline: "none",
  fontSize: "sm",
  color: "fg.default",
  _placeholder: { color: "fg.subtle" },
  "&::-webkit-search-cancel-button": { display: "none" },
});

export const countClass = css({
  flexShrink: 0,
  fontSize: "xs",
  color: "fg.subtle",
  fontVariantNumeric: "tabular-nums",
});

// The list fades out at an edge only while more rows hide past it.
const FADE = "16px";
export const listClass = css({
  position: "relative",
  flex: "1",
  minH: "0",
  overflowY: "auto",
  overscrollBehavior: "contain",
  scrollbarWidth: "thin",
  listStyle: "none",
  m: "0",
  p: "0",
  "&[data-fade=top]": {
    maskImage: `linear-gradient(to bottom, transparent, black ${FADE})`,
  },
  "&[data-fade=bottom]": {
    maskImage: `linear-gradient(to top, transparent, black ${FADE})`,
  },
  "&[data-fade=both]": {
    maskImage: `linear-gradient(to bottom, transparent, black ${FADE}, black calc(100% - ${FADE}), transparent)`,
  },
});

export const rowClass = css({
  display: "block",
  w: "full",
  textAlign: "left",
  py: "1",
  pr: "2",
  borderRadius: "l2",
  fontSize: "sm",
  lineHeight: "1.4",
  color: "fg.muted",
  overflowWrap: "anywhere",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "bg.hover", color: "fg.default" },
  _active: { bg: "bg.active" },
  // The keyboard cursor from the filter field looks like keyboard focus.
  "&:focus-visible, &[data-cursor=true]": {
    outline: "2px solid",
    outlineColor: "border.focus",
    outlineOffset: "-2px",
    color: "fg.default",
  },
  "&[data-depth='0']": { fontWeight: "medium" },
  "&[data-active=true]": { bg: "bg.selected", color: "fg.default" },
  "&[data-touch=true]": { py: "2.5", pr: "3", fontSize: "md" },
  _motionReduce: { transition: "none" },
});

// Opaque fills that match the row under the button, so the icon can cover
// the end of a long title on hover without reserving space on every row.
const rowFill = (tint: string) =>
  `linear-gradient(token(colors.${tint}), token(colors.${tint})), token(colors.bg.default)`;

export const linkButtonClass = css({
  position: "absolute",
  top: "1",
  right: "1",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  w: "5",
  h: "5",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  opacity: "0",
  pointerEvents: "none",
  transitionProperty: "opacity, color, transform",
  transitionDuration: "140ms",
  "li:hover > &": {
    opacity: "1",
    pointerEvents: "auto",
    background: rowFill("bg.hover"),
  },
  "li:hover > [data-active=true] + &": { background: rowFill("bg.selected") },
  "&[data-copied]": { opacity: "1" },
  _hover: { color: "fg.default" },
  _active: { transform: "scale(0.88)" },
  "&[data-copied=true]": { color: "fg.success" },
  _motionReduce: { transition: "none" },
});

export const emptyClass = css({
  px: "2",
  py: "1",
  fontSize: "sm",
  lineHeight: "1.4",
  color: "fg.subtle",
  overflowWrap: "anywhere",
});
