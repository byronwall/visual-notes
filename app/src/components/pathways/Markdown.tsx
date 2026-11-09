import { createMemo } from "solid-js";
import { css, cx } from "styled-system/css";
import { normalizeMarkdownToHtml } from "~/server/lib/markdown";

// Compact prose for the side panel: research findings and goals. Agents
// write markdown, so it renders as markdown, at panel size.
const prose = css({
  fontSize: "xs",
  lineHeight: "1.55",
  color: "fg.default",
  overflowWrap: "anywhere",
  "& > :first-child": { mt: "0" },
  "& > :last-child": { mb: "0" },
  "& p": { my: "1.5" },
  "& ul, & ol": { my: "1.5", pl: "4" },
  "& ul": { listStyle: "disc" },
  "& ol": { listStyle: "decimal" },
  "& li + li": { mt: "1" },
  "& li > ul, & li > ol": { my: "1" },
  "& h1, & h2, & h3, & h4": {
    mt: "3",
    mb: "1",
    fontSize: "sm",
    fontWeight: "semibold",
  },
  "& strong": { fontWeight: "semibold" },
  "& a": {
    color: "fg.link",
    textDecoration: "none",
    _hover: { color: "fg.linkHover" },
  },
  "& code": {
    px: "1",
    borderRadius: "sm",
    bg: "bg.subtle",
    fontSize: "0.95em",
  },
  "& pre": {
    my: "2",
    p: "2",
    borderRadius: "md",
    bg: "bg.subtle",
    whiteSpace: "pre-wrap",
  },
  "& blockquote": {
    my: "2",
    pl: "2.5",
    color: "fg.muted",
    borderLeftWidth: "2px",
    borderColor: "border",
  },
  "& table": {
    display: "block",
    maxW: "full",
    overflowX: "auto",
    borderCollapse: "collapse",
    my: "2",
  },
  "& th, & td": {
    borderWidth: "1px",
    borderColor: "border",
    px: "1.5",
    py: "0.5",
    textAlign: "left",
    verticalAlign: "top",
  },
});

export function Markdown(props: { text: string; class?: string }) {
  // Links open in a new tab, never in place of the map.
  const html = createMemo(() =>
    normalizeMarkdownToHtml(props.text).replaceAll(
      "<a ",
      '<a target="_blank" rel="noreferrer" ',
    ),
  );
  return <div class={cx(prose, props.class)} innerHTML={html()} />;
}
