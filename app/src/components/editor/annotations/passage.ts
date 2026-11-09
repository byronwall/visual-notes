import type { Node as PMNode } from "@tiptap/pm/model";
import { locateQuote } from "~/lib/annotations/anchor";
import type { AnnotationView } from "~/lib/annotations/types";
import { findBlock } from "../proposals/proposalTransaction";
import { blockText } from "./blockText";

// A passage is a range of text that starts in one block and may end in a
// later one. It is stored as the start block and offset, the end block and
// offset, and the quoted text: each block's part joined by newlines.

export type Range = { from: number; to: number };

export type Passage = {
  blockId: string;
  quote: string;
  quoteStart: number;
  /** Null when the passage ends in its start block. */
  endBlockId: string | null;
  endOffset: number | null;
  from: number;
  to: number;
};

type Textblock = { node: PMNode; pos: number; id: string };

/** Text blocks with an id that the range touches, in document order. */
function textblocksBetween(doc: PMNode, from: number, to: number): Textblock[] {
  const out: Textblock[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    const id = node.attrs?.id;
    if (typeof id === "string" && id) out.push({ node, pos, id });
    return false;
  });
  return out;
}

/**
 * The passage for a document range, clamped to the text blocks it covers.
 * Null when it covers no text (only images, rules, or whitespace).
 */
export function passageAt(doc: PMNode, from: number, to: number): Passage | null {
  const blocks = textblocksBetween(doc, from, to);
  if (blocks.length === 0) return null;
  const first = blocks[0];
  const last = blocks[blocks.length - 1];
  const start = Math.max(from, first.pos + 1);
  const end = Math.min(to, last.pos + last.node.nodeSize - 1);
  if (end <= start) return null;
  const firstText = blockText(first.node, first.pos);
  const lastText = blockText(last.node, last.pos);
  const quoteStart = firstText.offsetAt(start);
  const endOffset = lastText.offsetAt(end);
  const parts = blocks.map((block, index) => {
    const text = index === 0 ? firstText : index === blocks.length - 1 ? lastText : blockText(block.node, block.pos);
    const a = index === 0 ? quoteStart : 0;
    const b = index === blocks.length - 1 ? endOffset : text.text.length;
    return text.text.slice(a, b);
  });
  const quote = parts.join("\n");
  if (!quote.trim()) return null;
  const spans = first.id !== last.id;
  return {
    blockId: first.id,
    quote,
    quoteStart,
    endBlockId: spans ? last.id : null,
    endOffset: spans ? endOffset : null,
    from: start,
    to: end,
  };
}

/**
 * Where a stored passage sits in this document, or null when its blocks or
 * text are gone. The stored offsets win when the text still matches;
 * otherwise the first and last lines are looked up near them.
 */
export function resolvePassage(doc: PMNode, annotation: AnnotationView): Range | null {
  if (!annotation.blockId || !annotation.quote || annotation.detached) return null;
  const start = findBlock(doc, annotation.blockId);
  if (!start?.node.isTextblock) return null;
  const startText = blockText(start.node, start.pos);

  if (!annotation.endBlockId) {
    const at = locateQuote(startText.text, annotation.quote, annotation.quoteStart);
    if (at === null) return null;
    return { from: startText.posAt(at), to: startText.posAt(at + annotation.quote.length) };
  }

  const end = findBlock(doc, annotation.endBlockId);
  if (!end?.node.isTextblock || end.pos <= start.pos) return null;
  const endText = blockText(end.node, end.pos);
  const exact = {
    from: startText.posAt(annotation.quoteStart ?? 0),
    to: endText.posAt(annotation.endOffset ?? 0),
  };
  if (exact.to > exact.from && passageAt(doc, exact.from, exact.to)?.quote === annotation.quote) {
    return exact;
  }
  const lines = annotation.quote.split("\n");
  const head = lines[0];
  const tail = lines[lines.length - 1];
  const headAt = head ? locateQuote(startText.text, head, annotation.quoteStart) : (annotation.quoteStart ?? 0);
  const tailAt = tail
    ? locateQuote(endText.text, tail, (annotation.endOffset ?? tail.length) - tail.length)
    : 0;
  if (headAt === null || tailAt === null) return null;
  const range = { from: startText.posAt(headAt), to: endText.posAt(tailAt + tail.length) };
  return range.to > range.from ? range : null;
}
