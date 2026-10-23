import { css } from "styled-system/css";

/**
 * Reading-focused overrides for the public share page. Selectors use both
 * content classes so they win over the shared editor/document styles.
 */
export const shareReadingClass = css({
  "& .vn-share-content.vn-doc-content": {
    fontSize: { base: "md", md: "lg" },
    lineHeight: "1.75",
    color: "fg.default",
    overflowWrap: "break-word",
  },
  "& .vn-share-content.vn-doc-content p": {
    marginBottom: "5",
  },
  "& .vn-share-content.vn-doc-content h1, & .vn-share-content.vn-doc-content h2, & .vn-share-content.vn-doc-content h3":
    {
      letterSpacing: "-0.015em",
      scrollMarginTop: "6",
      textWrap: "balance",
    },
  "& .vn-share-content.vn-doc-content h1": {
    fontSize: { base: "2xl", md: "3xl" },
    marginTop: "12",
    marginBottom: "4",
  },
  "& .vn-share-content.vn-doc-content h2": {
    fontSize: { base: "xl", md: "2xl" },
    fontWeight: "semibold",
    marginTop: "12",
    marginBottom: "3",
  },
  "& .vn-share-content.vn-doc-content h3": {
    fontSize: { base: "lg", md: "xl" },
    fontWeight: "semibold",
    marginTop: "8",
    marginBottom: "2",
  },
  "& .vn-share-content.vn-doc-content a": {
    color: "blue.11",
    textDecorationLine: "none",
    transitionProperty: "color, text-decoration-color",
    transitionDuration: "140ms",
    _hover: {
      color: "blue.12",
      textDecorationLine: "underline",
      textDecorationThickness: "1px",
      textUnderlineOffset: "0.18em",
    },
  },
  "& .vn-share-content.vn-doc-content ul, & .vn-share-content.vn-doc-content ol":
    {
      paddingLeft: "6",
      marginBottom: "5",
    },
  "& .vn-share-content.vn-doc-content ul": { listStyleType: "disc" },
  "& .vn-share-content.vn-doc-content ol": { listStyleType: "decimal" },
  "& .vn-share-content.vn-doc-content li": {
    marginBottom: "1.5",
    paddingLeft: "1",
  },
  "& .vn-share-content.vn-doc-content li > p": {
    marginBottom: "0",
  },
  "& .vn-share-content.vn-doc-content li::marker": {
    color: "fg.subtle",
  },
  "& .vn-share-content.vn-doc-content ul[data-type=\"taskList\"]": {
    listStyleType: "none",
    paddingLeft: "0",
  },
  "& .vn-share-content.vn-doc-content li[data-type=\"taskItem\"]": {
    position: "relative",
    paddingLeft: "8",
  },
  "& .vn-share-content.vn-doc-content li[data-type=\"taskItem\"]::before": {
    content: "\"\"",
    position: "absolute",
    left: "1",
    top: "0.4em",
    width: "1em",
    height: "1em",
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "gray.8",
    borderRadius: "l1",
  },
  "& .vn-share-content.vn-doc-content li[data-type=\"taskItem\"][data-checked=\"true\"]":
    {
      color: "fg.muted",
      textDecorationLine: "line-through",
      textDecorationColor: "gray.8",
    },
  "& .vn-share-content.vn-doc-content li[data-type=\"taskItem\"][data-checked=\"true\"]::before":
    {
      borderColor: "blue.9",
      bg: "blue.9",
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27 fill=%27none%27 stroke=%27white%27 stroke-width=%272.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M3.5 8.5l3 3 6-7%27/%3E%3C/svg%3E\")",
      backgroundSize: "100%",
    },
  "& .vn-share-content.vn-doc-content blockquote": {
    borderLeftWidth: "3px",
    borderLeftColor: "blue.7",
    paddingLeft: "5",
    paddingY: "1",
    marginY: "6",
    color: "fg.muted",
    fontSize: { base: "lg", md: "xl" },
    lineHeight: "1.6",
  },
  "& .vn-share-content.vn-doc-content blockquote p:last-child": {
    marginBottom: "0",
  },
  "& .vn-share-content.vn-doc-content :not(pre) > code": {
    bg: "bg.muted",
    borderRadius: "l1",
    paddingX: "1",
    paddingY: "0.5",
    fontSize: "0.88em",
  },
  "& .vn-share-content.vn-doc-content pre": {
    bg: "bg.subtle",
    borderRadius: "l3",
    paddingX: "5",
    paddingY: "4",
    marginY: "6",
    fontFamily: "mono",
    fontSize: "sm",
    lineHeight: "1.65",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  "& .vn-share-content.vn-doc-content pre code": {
    bg: "transparent",
    padding: "0",
    fontSize: "inherit",
  },
  "& .vn-share-content.vn-doc-content table": {
    display: "block",
    width: "max-content",
    maxWidth: "100%",
    overflowX: "auto",
    marginY: "6",
    borderWidth: "0",
    fontSize: "md",
    lineHeight: "1.5",
  },
  "& .vn-share-content.vn-doc-content th, & .vn-share-content.vn-doc-content td":
    {
      borderWidth: "0",
      borderBottomWidth: "1px",
      borderColor: "border",
      paddingX: "4",
      paddingY: "2",
      bg: "transparent",
      textAlign: "left",
    },
  "& .vn-share-content.vn-doc-content tbody tr:nth-of-type(odd) td, & .vn-share-content.vn-doc-content tbody tr:nth-of-type(even) td":
    {
      bg: "transparent",
    },
  "& .vn-share-content.vn-doc-content th": {
    color: "fg.muted",
    fontWeight: "semibold",
    fontSize: "sm",
  },
  "& .vn-share-content.vn-doc-content th p, & .vn-share-content.vn-doc-content td p":
    {
      marginBottom: "0",
    },
  "& .vn-share-content.vn-doc-content hr": {
    borderTopColor: "border",
    marginY: "10",
  },
  "& .vn-share-content.vn-doc-content img": {
    borderRadius: "l3",
    marginY: "6",
  },
});
