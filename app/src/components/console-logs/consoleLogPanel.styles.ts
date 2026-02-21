import { css } from "styled-system/css";
import { type ConsoleCaptureEntry } from "~/lib/console-log-capture";

export const tooltipContentProps = { zIndex: "tooltip" } as const;

export const rowClass = (expanded: boolean) =>
  css({
    width: "full",
    textAlign: "left",
    borderWidth: expanded ? "1px" : "0",
    borderColor: "black.a4",
    borderRadius: expanded ? "l2" : "0",
    px: expanded ? "2.5" : "1.5",
    py: expanded ? "2" : "1.5",
    bg: expanded ? "black.a1" : "transparent",
    transition: "background 100ms ease, border-color 120ms ease",
    "& .log-row-copy": {
      opacity: 0,
      pointerEvents: "none",
      transition: "opacity 120ms ease",
    },
    _hover: {
      bg: expanded ? "black.a1" : "black.a1",
      "& .log-row-copy": {
        opacity: 1,
        pointerEvents: "auto",
      },
    },
    _focusWithin: {
      "& .log-row-copy": {
        opacity: 1,
        pointerEvents: "auto",
      },
    },
  });

export const levelChipClass = (level: ConsoleCaptureEntry["level"]) =>
  css({
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "full",
    px: "1.5",
    py: "0.5",
    fontSize: "2xs",
    fontWeight: "semibold",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    borderWidth: "0",
    color:
      level === "error"
        ? "red.11"
        : level === "warn"
          ? "amber.11"
          : level === "info"
            ? "blue.11"
            : "fg.muted",
    bg:
      level === "error"
        ? "red.3"
        : level === "warn"
          ? "amber.3"
          : level === "info"
            ? "blue.3"
            : "black.a2",
    flexShrink: "0",
  });

export const prefixChipClass = css({
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "full",
  px: "1.5",
  py: "0.5",
  fontSize: "2xs",
  fontWeight: "medium",
  bg: "black.a2",
  color: "fg.muted",
  borderWidth: "0",
  flexShrink: "0",
});

export const detailsClass = css({
  mt: "1.5",
  p: "2",
  borderRadius: "l2",
  borderWidth: "1px",
  borderColor: "black.a3",
  bg: "bg.subtle",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontFamily: "mono",
  fontSize: "xs",
  lineHeight: "1.45",
  maxH: "280px",
  overflowY: "auto",
  userSelect: "text",
});

export const rowTitleClass = css({
  cursor: "pointer",
});
