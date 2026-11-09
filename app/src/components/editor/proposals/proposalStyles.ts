import { css } from "styled-system/css";

// Classes for the suggestion widgets, which ProseMirror renders as plain DOM.

/** A block a pending edit would replace or delete. */
export const oldBlockClass = css({
  textDecoration: "line-through",
  textDecorationColor: "red.9",
  color: "fg.muted",
  bg: "red.2",
  borderRadius: "l1",
});

export const cardClass = css({
  my: "2",
  borderWidth: "1px",
  borderColor: "green.7",
  borderLeftWidth: "3px",
  borderRadius: "l2",
  bg: "green.2",
  px: "3",
  py: "2",
  fontSize: "inherit",
  "&[data-stale=true]": { borderColor: "amber.7", bg: "amber.2" },
  "&[data-kind=delete]": { borderColor: "red.7", bg: "red.2" },
});

export const cardHeaderClass = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  flexWrap: "wrap",
  fontSize: "xs",
  color: "fg.muted",
  mb: "1",
  userSelect: "none",
});

export const cardLabelClass = css({
  fontWeight: "semibold",
  color: "fg.default",
});

export const cardActionsClass = css({
  display: "flex",
  gap: "1",
  ml: "auto",
});

export const buttonClass = css({
  fontSize: "xs",
  fontWeight: "medium",
  px: "2",
  py: "0.5",
  borderRadius: "l1",
  borderWidth: "1px",
  borderColor: "border",
  bg: "bg.default",
  cursor: "pointer",
  _hover: { bg: "bg.muted" },
  "&[data-primary=true]": {
    bg: "green.9",
    borderColor: "green.9",
    color: "white",
    _hover: { bg: "green.10" },
  },
});

export const previewClass = css({
  "& > :first-child": { mt: "0" },
  "& > :last-child": { mb: "0" },
});
