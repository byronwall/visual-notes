export const documentContentStyles = {
  "& .ProseMirror, & .vn-doc-content": {
    color: "fg.default",
    fontSize: "md",
    lineHeight: "1.75",
    outline: "none",
    minWidth: "0",
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
    marginTop: "8",
    marginBottom: "4",
  },
  "& .ProseMirror h2, & .vn-doc-content h2": {
    fontSize: "2xl",
    lineHeight: "1.2",
    fontWeight: "700",
    marginTop: "7",
    marginBottom: "3",
  },
  "& .ProseMirror h3, & .vn-doc-content h3": {
    fontSize: "xl",
    lineHeight: "1.3",
    fontWeight: "600",
    marginTop: "6",
    marginBottom: "3",
  },
  "& .ProseMirror ul, & .ProseMirror ol, & .vn-doc-content ul, & .vn-doc-content ol":
    {
      paddingLeft: "6",
      marginTop: "0",
      marginBottom: "4",
    },
  "& .ProseMirror li, & .vn-doc-content li": {
    marginBottom: "1.5",
  },
  "& .ProseMirror blockquote, & .vn-doc-content blockquote": {
    borderLeftWidth: "3px",
    borderLeftColor: "gray.outline.border",
    paddingLeft: "4",
    color: "fg.muted",
    marginTop: "0",
    marginBottom: "4",
  },
  "& .ProseMirror a, & .vn-doc-content a": {
    color: "blue.10",
    textDecorationLine: "underline",
    textUnderlineOffset: "2px",
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
    fontSize: "0.92em",
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
    outlineColor: "blue.9",
    outlineOffset: "2px",
    borderRadius: "l2",
  },
  "& .ProseMirror .ProseMirror-selectednode img.vn-image, & .ProseMirror .vn-image-node[data-selected='true'] img.vn-image":
    {
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: "blue.9",
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
    bg: "gray.surface.bg",
    fontWeight: "semibold",
  },
  "& .ProseMirror tbody tr:nth-of-type(odd) td, & .vn-doc-content tbody tr:nth-of-type(odd) td":
    {
      bg: "bg.default",
    },
  "& .ProseMirror tbody tr:nth-of-type(even) td, & .vn-doc-content tbody tr:nth-of-type(even) td":
    {
      bg: "gray.surface.bg.hover",
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
  "& .ProseMirror .vn-codeblock-content, & .vn-doc-content .vn-codeblock-content": {
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
      transform: "translateY(-12px)",
      paddingTop: "2px",
    },
  "& .ProseMirror .vn-codeblock-line-number, & .vn-doc-content .vn-codeblock-line-number":
    {
      display: "block",
      height: "1.6em",
      lineHeight: "1.6em",
    },
} as const;
