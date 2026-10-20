import type { NoteDoc, NoteNode } from "./types";

export type BlockOp =
  | { op: "replace"; blockId: string; blocks: NoteNode[] }
  | { op: "insert_after"; blockId: string; blocks: NoteNode[] }
  | { op: "delete"; blockId: string };

export class UnknownBlockError extends Error {
  constructor(readonly blockId: string) {
    super(`Unknown block id ${blockId}`);
    this.name = "UnknownBlockError";
  }
}

const LIST_TYPES = new Set(["bulletList", "orderedList"]);

type Location = { parent: NoteNode; index: number };

function locate(node: NoteNode, blockId: string): Location | null {
  const children = node.content ?? [];
  for (let i = 0; i < children.length; i++) {
    if (children[i].attrs?.id === blockId) return { parent: node, index: i };
    const inner = locate(children[i], blockId);
    if (inner) return inner;
  }
  return null;
}

/** Shapes parsed blocks to fit where they go (list items inside lists). */
function adaptForParent(parent: NoteNode, blocks: NoteNode[]): NoteNode[] {
  if (!LIST_TYPES.has(parent.type)) return blocks;
  const items: NoteNode[] = [];
  let loose: NoteNode[] = [];
  const flush = () => {
    if (loose.length) items.push({ type: "listItem", content: loose });
    loose = [];
  };
  for (const block of blocks) {
    if (LIST_TYPES.has(block.type)) {
      flush();
      items.push(...(block.content ?? []));
    } else if (block.type === "listItem") {
      flush();
      items.push(block);
    } else {
      loose.push(block);
    }
  }
  flush();
  return items;
}

const withId = (node: NoteNode, id: string): NoteNode => ({
  ...node,
  attrs: { ...(node.attrs ?? {}), id },
});

/** Drops empty containers left behind by a delete. */
function prune(node: NoteNode): NoteNode | null {
  if (!node.content) return node;
  const content = node.content
    .map(prune)
    .filter((child): child is NoteNode => child !== null);
  if (content.length === 0 && node.type !== "doc") {
    if (LIST_TYPES.has(node.type) || node.type === "blockquote") return null;
    if (node.type === "listItem" || node.type === "tableCell" || node.type === "tableHeader") {
      return { ...node, content: [{ type: "paragraph" }] };
    }
  }
  return { ...node, content };
}

/**
 * Applies id-addressed edits to a copy of the document. A replaced block's
 * first replacement keeps its id so links to it keep working. Throws
 * UnknownBlockError for an id that is not in the note.
 */
export function applyBlockOps(doc: NoteDoc, ops: BlockOp[]): NoteDoc {
  const next = structuredClone(doc) as NoteDoc;
  for (const op of ops) {
    const at = locate(next, op.blockId);
    if (!at) throw new UnknownBlockError(op.blockId);
    const siblings = at.parent.content!;
    if (op.op === "delete") {
      siblings.splice(at.index, 1);
      continue;
    }
    const blocks = adaptForParent(at.parent, op.blocks);
    if (op.op === "replace") {
      const [first, ...rest] = blocks;
      const replacement = first ? [withId(first, op.blockId), ...rest] : [];
      siblings.splice(at.index, 1, ...replacement);
    } else {
      siblings.splice(at.index + 1, 0, ...blocks);
    }
  }
  const pruned = prune(next) as NoteDoc;
  if (!pruned.content?.length) pruned.content = [{ type: "paragraph" }];
  return pruned;
}

/** Ids a client may target, in document order. */
export function listBlockIds(doc: NoteDoc): string[] {
  const out: string[] = [];
  const visit = (node: NoteNode) => {
    if (typeof node.attrs?.id === "string") out.push(node.attrs.id);
    node.content?.forEach(visit);
  };
  visit(doc);
  return out;
}
