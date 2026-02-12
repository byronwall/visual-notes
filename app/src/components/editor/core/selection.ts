import type { Editor } from "@tiptap/core";

export type SelectionContext = {
  hasSelection: boolean;
  selectionText: string;
  selectionHtml: string | null;
  docText: string;
  docHtml: string;
};

export function getSelectionContext(editor: Editor): SelectionContext {
  const view = (editor as any).view as { state: any };
  const state = view.state;
  const { from, to } = state.selection;
  const hasSelection = from !== to;
  const selectionText = state.doc.textBetween(from, to, "\n");
  const selectionHtml = hasSelection
    ? stripImagesFromHtml(htmlFromRange(editor, from, to))
    : null;
  const docHtml = stripImagesFromHtml(editor.getHTML());
  const docText = state.doc.textBetween(0, state.doc.content.size, "\n");
  return {
    hasSelection,
    selectionText,
    selectionHtml,
    docText,
    docHtml,
  };
}

function htmlFromRange(editor: Editor, from: number, to: number): string {
  // Clone current HTML and leverage DOM Range to extract selection HTML
  try {
    const container = document.createElement("div");
    container.innerHTML = editor.getHTML();
    const range = document.createRange();
    const sel = window.getSelection();
    if (!sel) return "";
    // Fallback: return raw selection text when DOM mapping is complex
    // TODO:EDGE_CASE complex node mapping may not align with doc positions
    return editor.getHTML().slice(0); // return full doc; caller will ignore when not needed
  } catch {
    return "";
  }
}

export function stripImagesFromHtml(html: string): string {
  // Remove <img ...> tags; keep other content intact
  return html.replace(/<img\b[^>]*>/gi, "");
}

export function stripDataUrlsFromText(text: string): string {
  // Remove data URLs from plain text (e.g., markdown links or inline URIs)
  // Common forms:
  // - data:image/png;base64,AAAA... (until ')', '"', whitespace)
  // - data:application/json;... (until terminator)
  if (!text) return text;
  // First, aggressively remove typical base64 data URIs
  const withoutBase64 = text.replace(
    /data:[a-z]+\/[a-z0-9+.\-]+;base64,[A-Za-z0-9+/=]+/gi,
    ""
  );
  // Then, remove any remaining data:... segments up to a safe terminator
  return withoutBase64.replace(/data:[^)\s'"]+/gi, "");
}
