import { css } from "styled-system/css";

export const documentContentStyles = {
  "& .ProseMirror, & .vn-doc-content": {
    color: "fg.default",
    fontSize: "md",
    lineHeight: "1.7",
    outline: "none",
    minWidth: "0",
    textRendering: "optimizeLegibility",
    fontKerning: "normal",
    overflowWrap: "break-word",
  },
  // Empty-state hints for a blank note: the leading H1 and the paragraph
  // after it show placeholders until the user types.
  "& .ProseMirror > h1:first-child:has(> br.ProseMirror-trailingBreak:only-child)::before":
    {
      content: '"Untitled"',
      color: "fg.subtle",
      float: "left",
      height: "0",
      pointerEvents: "none",
    },
  "& .ProseMirror > h1:first-child + p:last-child:has(> br.ProseMirror-trailingBreak:only-child)::before":
    {
      content: '"Start writing…"',
      color: "fg.subtle",
      float: "left",
      height: "0",
      pointerEvents: "none",
    },
  "& .ProseMirror > *:first-child, & .vn-doc-content > *:first-child": {
    marginTop: "0",
  },
  "& .ProseMirror > *:last-child, & .vn-doc-content > *:last-child": {
    marginBottom: "0",
  },
  "& .ProseMirror p, & .vn-doc-content p": {
    marginTop: "0",
    marginBottom: "4",
  },
  "& .ProseMirror h1, & .vn-doc-content h1": {
    fontSize: "3xl",
    lineHeight: "1.15",
    fontWeight: "700",
    letterSpacing: "-0.02em",
    marginTop: "8",
    marginBottom: "4",
  },
  "& .ProseMirror h2, & .vn-doc-content h2": {
    fontSize: "2xl",
    lineHeight: "1.25",
    fontWeight: "650",
    letterSpacing: "-0.015em",
    marginTop: "8",
    marginBottom: "3",
  },
  "& .ProseMirror h3, & .vn-doc-content h3": {
    fontSize: "lg",
    lineHeight: "1.35",
    fontWeight: "600",
    letterSpacing: "-0.01em",
    marginTop: "6",
    marginBottom: "2",
  },
  "& .ProseMirror h4, & .vn-doc-content h4": {
    fontSize: "md",
    lineHeight: "1.4",
    fontWeight: "600",
    marginTop: "5",
    marginBottom: "2",
  },
  // Headings carry their own top margin, so text that follows another
  // heading should not double the gap.
  "& .ProseMirror :is(h1,h2,h3,h4) + :is(h2,h3,h4), & .vn-doc-content :is(h1,h2,h3,h4) + :is(h2,h3,h4)":
    {
      marginTop: "3",
    },
  "& .ProseMirror ul, & .ProseMirror ol, & .vn-doc-content ul, & .vn-doc-content ol":
    {
      paddingLeft: "6",
      marginTop: "0",
      marginBottom: "4",
    },
  "& .ProseMirror li, & .vn-doc-content li": {
    marginBottom: "1",
  },
  "& .ProseMirror li > p, & .vn-doc-content li > p": {
    marginBottom: "1",
  },
  "& .ProseMirror li::marker, & .vn-doc-content li::marker": {
    color: "fg.subtle",
  },
  // The global `.prose blockquote` adds a blue wash; quotes here stay
  // typographic: a thin rule and muted text.
  "& .ProseMirror blockquote, & .vn-doc-content blockquote": {
    borderLeftWidth: "2px",
    borderLeftStyle: "solid",
    borderLeftColor: "gray.a6",
    bg: "transparent",
    paddingLeft: "4",
    py: "0",
    color: "fg.muted",
    marginTop: "0",
    marginBottom: "4",
    borderRadius: "0",
  },
  "& .ProseMirror blockquote p, & .vn-doc-content blockquote p": {
    marginBottom: "2",
  },
  // Links read as colored text only; the global `.prose a` highlight is
  // reset so long notes with many links stay calm.
  "& .ProseMirror a, & .vn-doc-content a": {
    color: "amber.11",
    textDecorationLine: "none",
    borderBottomWidth: "0",
    bg: "transparent",
    boxShadow: "none",
    borderRadius: "l1",
    transitionProperty: "color, background-color",
    transitionDuration: "140ms",
  },
  "& .ProseMirror a:hover, & .vn-doc-content a:hover": {
    color: "amber.12",
    bg: "amber.a3",
    boxShadow: "none",
  },
  // Links to other notes read as internal references, distinct from web links.
  "& a.note-link": {
    color: "blue.11",
    bg: "blue.a2",
    paddingInline: "1",
    cursor: "pointer",
  },
  "& a.note-link:hover": { color: "blue.12", bg: "blue.a4" },
  "& a.note-link[data-missing]": {
    color: "fg.muted",
    bg: "transparent",
    textDecorationLine: "line-through",
  },
  "& .ProseMirror a.note-link.ProseMirror-selectednode": {
    outline: "2px solid",
    outlineColor: "blue.a7",
  },
  "& a.note-tag": {
    color: "grass.11",
    bg: "grass.a2",
    paddingInline: "1",
    borderRadius: "l1",
    fontSize: "0.92em",
    cursor: "pointer",
  },
  "& a.note-tag:hover": { color: "grass.12", bg: "grass.a4" },
  "& .block-flash": {
    bg: "amber.a4",
    borderRadius: "l1",
    transition: "background-color 600ms ease-out",
  },
  "& .ProseMirror hr, & .vn-doc-content hr": {
    border: "0",
    borderTopWidth: "1px",
    borderTopColor: "gray.outline.border",
    marginTop: "6",
    marginBottom: "6",
  },
  "& .ProseMirror code, & .vn-doc-content code": {
    fontFamily: "mono",
    fontSize: "0.875em",
  },
  // Inline code: a soft tint, no border box around a single word.
  "& .ProseMirror :not(pre) > code, & .vn-doc-content :not(pre) > code": {
    bg: "gray.a3",
    borderWidth: "0",
    borderRadius: "l1",
    px: "0.3em",
    py: "0.1em",
    color: "fg.default",
  },
  "& .ProseMirror pre, & .vn-doc-content pre": {
    overflowX: "auto",
  },
  "& .ProseMirror img, & .vn-doc-content img": {
    display: "block",
    maxWidth: "100%",
    height: "auto",
  },
  // ProseMirror adds this class to the currently selected node.
  // Add a clear selection ring for images without shifting layout.
  "& .ProseMirror img.ProseMirror-selectednode": {
    outlineWidth: "2px",
    outlineStyle: "solid",
    outlineColor: "amber.9",
    outlineOffset: "2px",
    borderRadius: "l2",
  },
  "& .ProseMirror .ProseMirror-selectednode img.vn-image, & .ProseMirror .vn-image-node[data-selected='true'] img.vn-image":
    {
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: "amber.9",
      outlineOffset: "2px",
      borderRadius: "l2",
    },
  "& .ProseMirror .vn-image-node, & .vn-doc-content .vn-image-node": {
    position: "relative",
    marginTop: "3",
    marginBottom: "3",
    maxWidth: "100%",
    minWidth: "0",
  },
  "& .ProseMirror .vn-image-node > img.vn-image, & .vn-doc-content .vn-image-node > img.vn-image":
    {
      display: "block",
      width: "100%",
      maxWidth: "100%",
      height: "auto",
      borderRadius: "l2",
      userSelect: "none",
    },
  "& .ProseMirror .vn-image-controls, & .vn-doc-content .vn-image-controls": {
    opacity: "0",
    visibility: "hidden",
    pointerEvents: "none",
    transition: "opacity 140ms ease, visibility 0ms linear 140ms",
  },
  "& .ProseMirror .vn-image-node[data-selected='true'] .vn-image-controls, & .ProseMirror .vn-image-node[data-resizing='true'] .vn-image-controls":
    {
      opacity: "1",
      visibility: "visible",
      pointerEvents: "auto",
      transition: "opacity 140ms ease",
    },
  "& .ProseMirror .vn-image-resize-handle": {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: "16px",
    height: "36px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "gray.outline.border",
    borderRadius: "full",
    background: "bg.default",
    boxShadow: "sm",
    cursor: "ew-resize",
    opacity: "0",
    visibility: "hidden",
    pointerEvents: "none",
    transition: "opacity 120ms ease, visibility 0ms linear 120ms",
  },
  "& .ProseMirror .vn-image-node[data-selected='true'] .vn-image-resize-handle, & .ProseMirror .vn-image-node[data-resizing='true'] .vn-image-resize-handle":
    {
      opacity: "1",
      visibility: "visible",
      pointerEvents: "auto",
      transition: "opacity 120ms ease",
    },
  "& .ProseMirror .vn-image-resize-handle-left": {
    left: "-9px",
  },
  "& .ProseMirror .vn-image-resize-handle-right": {
    right: "-9px",
  },
  "& .ProseMirror table, & .vn-doc-content table": {
    width: "100%",
    marginTop: "2",
    marginBottom: "5",
    borderRadius: "0",
    fontSize: "sm",
    borderCollapse: "collapse",
    borderSpacing: 0,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "border",
  },
  "& .ProseMirror th, & .ProseMirror td, & .vn-doc-content th, & .vn-doc-content td":
    {
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: "border",
      px: "3",
      py: "2",
      verticalAlign: "top",
      bg: "bg.default",
      color: "fg.default",
    },
  "& .ProseMirror th, & .vn-doc-content th": {
    bg: "bg.subtle",
    fontSize: "sm",
    fontWeight: "semibold",
    textAlign: "left",
  },
  "& .ProseMirror :is(th, td) > p, & .vn-doc-content :is(th, td) > p": {
    marginBottom: "0",
  },
  "& .ProseMirror .vn-codeblock-wrap, & .vn-doc-content .vn-codeblock-wrap": {
    position: "relative",
    marginTop: "3",
    marginBottom: "3",
    overflow: "visible",
  },
  "& .ProseMirror pre.vn-codeblock, & .vn-doc-content pre.vn-codeblock": {
    position: "relative",
    margin: "0",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "gray.outline.border",
    borderRadius: "l2",
    background: "gray.surface.bg",
    padding: "0",
    overflow: "visible",
    fontFamily: "mono",
    fontSize: "sm",
    lineHeight: "1.6",
  },
  "& .ProseMirror pre.vn-codeblock[data-collapsed='true'], & .vn-doc-content pre.vn-codeblock[data-collapsed='true']":
    {
      maxHeight: "calc(15 * 1.6em + 4.5rem)",
      overflowY: "auto",
      overflowX: "auto",
    },
  "& .ProseMirror .vn-codeblock-controls, & .vn-doc-content .vn-codeblock-controls":
    {
      opacity: "0",
      visibility: "hidden",
      pointerEvents: "none",
      transition: "opacity 140ms ease, visibility 0ms linear 140ms",
    },
  "& .ProseMirror .vn-codeblock-wrap:hover .vn-codeblock-controls, & .ProseMirror .vn-codeblock-wrap:focus-within .vn-codeblock-controls, & .ProseMirror .vn-codeblock-controls:hover":
    {
      opacity: "1",
      visibility: "visible",
      pointerEvents: "auto",
      transition: "opacity 140ms ease",
    },
  "& .ProseMirror .vn-codeblock-content, & .vn-doc-content .vn-codeblock-content":
    {
      display: "block",
      whiteSpace: "pre",
      position: "relative",
      zIndex: "1",
      fontFamily: "mono",
      fontSize: "sm",
      lineHeight: "1.6em",
    },
  "& .ProseMirror .vn-codeblock-line-gutter, & .vn-doc-content .vn-codeblock-line-gutter":
    {
      position: "absolute",
      left: "3",
      top: "3",
      bottom: "3",
      display: "block",
      width: "auto",
      minWidth: "3ch",
      color: "fg.muted",
      userSelect: "none",
      pointerEvents: "none",
      textAlign: "right",
      fontFamily: "mono",
      fontSize: "sm",
      lineHeight: "1.6em",
      zIndex: "0",
    },
  "& .ProseMirror .vn-codeblock-line-number, & .vn-doc-content .vn-codeblock-line-number":
    {
      display: "block",
      height: "1.6em",
      lineHeight: "1.6em",
    },
  // Borderless editors read as the page itself: no inset padding so text
  // lines up with the header, and the editable area fills the min height so
  // clicking below the last line still places the caret.
  "&[data-borderless=true] .ProseMirror": {
    px: "0",
    py: "2",
    flex: "1",
  },
} as const;

// Panda only extracts style objects it can evaluate statically in the same
// file, so the shared document styles are compiled here once. Passing the
// imported object to a `css` prop elsewhere silently generated no CSS.
export const documentContentClass = css(documentContentStyles);
