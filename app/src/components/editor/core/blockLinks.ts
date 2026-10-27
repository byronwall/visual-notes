import type { Editor } from "@tiptap/core";
import { toaster } from "~/components/ui/toast";
import { hasBlockId } from "~/lib/note-content/block-ids";

/** Id of the innermost block holding the cursor, if it has one. */
export function blockIdAtSelection(editor: Editor): string | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (hasBlockId(node.type.name) && node.attrs.id) return node.attrs.id;
  }
  return null;
}

export const blockAnchor = (blockId: string) => `b-${blockId}`;

/** Where a jumped-to heading lands: just under the sticky editor toolbar. */
export const HEADING_SCROLL_OFFSET = 80;

/** Scrolls a heading to the top, where the contents outline reads it as current. */
export function scrollHeadingToTop(el: HTMLElement) {
  const top =
    el.getBoundingClientRect().top + window.scrollY - HEADING_SCROLL_OFFSET;
  window.scrollTo({ top, behavior: "smooth" });
}

/** Copies `/docs/:id#b-:blockId` for the block at the cursor. */
export async function copyBlockLink(editor: Editor) {
  const blockId = blockIdAtSelection(editor);
  const docId = /^\/docs\/([^/]+)/.exec(window.location.pathname)?.[1];
  if (!blockId || !docId || docId === "new") {
    toaster.create({
      title: "Save the note first to link to a block",
      type: "warning",
    });
    return;
  }
  const url = `${window.location.origin}/docs/${docId}#${blockAnchor(blockId)}`;
  try {
    await navigator.clipboard.writeText(url);
    toaster.create({
      title: "Block link copied",
      description: url,
      type: "success",
    });
  } catch (e) {
    console.warn("[block-links] clipboard write failed", e);
    toaster.create({
      title: "Could not copy link",
      description: url,
      type: "error",
    });
  }
}

/**
 * Scrolls the block named by `#b-<id>` into view and flashes it. Returns
 * false when the block is not in this note.
 */
export function revealBlock(root: HTMLElement, hash: string): boolean {
  const match = /^#b-([A-Za-z0-9]+)$/.exec(hash);
  if (!match) return true;
  const el = root.querySelector<HTMLElement>(`[data-id="${match[1]}"]`);
  if (!el) return false;
  if (/^H[1-6]$/.test(el.tagName)) {
    // A heading opens its section, so it lands where an outline jump does.
    scrollHeadingToTop(el);
  } else {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  el.classList.add("block-flash");
  window.setTimeout(() => el.classList.remove("block-flash"), 1800);
  return true;
}
