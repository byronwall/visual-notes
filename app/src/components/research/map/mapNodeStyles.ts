import { css } from "styled-system/css";

export const nodeClass = css({
  position: "absolute",
  left: 0,
  top: 0,
  display: "flex",
  alignItems: "center",
  gap: "2",
  textAlign: "left",
  color: "fg.default",
  cursor: "pointer",
  borderRadius: "l2",
  userSelect: "none",
  transitionProperty: "background-color, opacity",
  transitionDuration: "140ms",
  animationName: "fade-in",
  animationDuration: "140ms",
  _hover: { bg: "bg.hover" },
  _active: { bg: "gray.a5" },
  _focusVisible: {
    outline: "2px solid token(colors.border.focus)",
    outlineOffset: "1px",
  },
  "&[data-side=left]": { flexDirection: "row-reverse", textAlign: "right" },
  "&[data-kind=root]": {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    gap: "1",
    px: "3",
    bg: "bg.subtle",
    cursor: "default",
    _hover: { bg: "bg.subtle" },
    _active: { bg: "bg.subtle" },
  },
  "&[data-kind=stream]": { px: "3", bg: "bg.subtle" },
  "&[data-kind=stream]:hover": { bg: "bg.hover" },
  "&[data-kind=section]": {
    flexDirection: "row",
    justifyContent: "center",
    gap: "1",
    px: "2",
    bg: "bg.subtle",
    fontSize: "xs",
    fontWeight: "medium",
    color: "fg.muted",
  },
  "&[data-kind=card]": { px: "1.5", fontSize: "sm", lineHeight: "18px" },
  "&[data-closed=true]": { color: "fg.muted" },
  "&[data-selected=true], &[data-selected=true]:hover": {
    bg: "bg.selected",
    color: "fg.selected",
  },
  "&[data-dimmed=true]": { opacity: 0.3 },
  "@media (prefers-reduced-motion: reduce)": {
    transitionProperty: "none",
    animationName: "none",
  },
  "[data-gliding=true] &": {
    transitionProperty: "transform, background-color, opacity",
    transitionDuration: "180ms",
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
});

export const clampClass = css({
  minW: 0,
  flex: 1,
  lineClamp: 2,
  overflowWrap: "anywhere",
});

export const metaClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  fontSize: "xs",
  color: "fg.muted",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
  overflow: "hidden",
  "[data-side=left] &": { justifyContent: "flex-end" },
});

export const chevronClass = css({
  flexShrink: 0,
  color: "fg.subtle",
  display: "inline-flex",
  transitionProperty: "transform",
  transitionDuration: "140ms",
  "[data-side=left] &": { transform: "rotate(180deg)" },
  "[aria-expanded=true] &": { transform: "rotate(90deg)" },
  "[data-side=left][aria-expanded=true] &": { transform: "rotate(90deg)" },
});

export const streamHeadClass = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "1",
  "[data-side=left] &": { flexDirection: "row-reverse" },
});

export const countButtonClass = css({
  flexShrink: 0,
  minW: "5",
  h: "5",
  px: "1",
  fontSize: "xs",
  color: "fg.muted",
  fontVariantNumeric: "tabular-nums",
  borderRadius: "l1",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "gray.a4", color: "fg.default" },
});
