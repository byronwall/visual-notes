import type { Node as PMNode } from "@tiptap/pm/model";

// A block's text as annotations count it: its text nodes joined, with no
// separators for inline atoms. Offsets into this text map to document
// positions and back.

type Segment = { start: number; pos: number; length: number };

export type BlockText = {
  text: string;
  /** Document position of a text offset (end offsets map past the last char). */
  posAt: (offset: number) => number;
  /** Text offset of a document position inside the block. */
  offsetAt: (pos: number) => number;
};

export function blockText(node: PMNode, nodePos: number): BlockText {
  const segments: Segment[] = [];
  let text = "";
  node.descendants((child, relPos) => {
    if (!child.isText) return true;
    segments.push({ start: text.length, pos: nodePos + 1 + relPos, length: child.text!.length });
    text += child.text;
    return false;
  });
  const posAt = (offset: number) => {
    for (const seg of segments) {
      if (offset <= seg.start + seg.length) return seg.pos + Math.max(0, offset - seg.start);
    }
    const last = segments.at(-1);
    return last ? last.pos + last.length : nodePos + 1;
  };
  const offsetAt = (pos: number) => {
    for (const seg of segments) {
      if (pos <= seg.pos + seg.length) return seg.start + Math.max(0, pos - seg.pos);
    }
    return text.length;
  };
  return { text, posAt, offsetAt };
}
