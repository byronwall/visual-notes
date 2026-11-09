import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { blockHash } from "~/lib/annotations/block-hash";
import type { ProposalOp } from "~/lib/annotations/types";
import { adaptForParent } from "~/lib/note-content/block-ops";
import type { NoteNode } from "~/lib/note-content/types";

export type FoundBlock = {
  node: PMNode;
  pos: number;
  parent: PMNode;
  /** Position of the parent node; -1 for the document itself. */
  parentPos: number;
};

/** The block whose `id` attribute matches, or null when it is gone. */
export function findBlock(doc: PMNode, id: string): FoundBlock | null {
  let found: FoundBlock | null = null;
  doc.descendants((node, pos, parent) => {
    if (found) return false;
    if (node.attrs?.id === id && parent) {
      const $pos = doc.resolve(pos);
      found = {
        node,
        pos,
        parent,
        parentPos: $pos.depth === 0 ? -1 : $pos.before(),
      };
      return false;
    }
    return true;
  });
  return found;
}

/**
 * Whether the edit no longer fits: its block is gone, or a replace or delete
 * targets a block that changed since the agent proposed it. An addition only
 * needs its anchor, so a rewrite of that block (often the same proposal's)
 * leaves it valid.
 */
export function isStale(doc: PMNode, op: ProposalOp): boolean {
  const block = findBlock(doc, op.blockId);
  if (!block) return true;
  if (op.op === "insert_after") return false;
  return blockHash(block.node.toJSON() as NoteNode) !== op.baseHash;
}

const CONTAINERS = new Set(["bulletList", "orderedList", "blockquote"]);

/**
 * The transaction that applies one proposed op to the editor, or null when
 * the block is gone or changed. A replaced block's first new block keeps the
 * old id so links to it keep working, as in `applyBlockOps`.
 */
export function proposalTransaction(
  state: EditorState,
  op: ProposalOp,
): Transaction | null {
  if (isStale(state.doc, op)) return null;
  const block = findBlock(state.doc, op.blockId)!;
  const tr = state.tr;
  const end = block.pos + block.node.nodeSize;

  if (op.op === "delete") {
    // Deleting the only child of a list or quote removes the container too,
    // so the document never holds an empty list.
    if (
      block.parent.childCount === 1 &&
      CONTAINERS.has(block.parent.type.name) &&
      block.parentPos >= 0
    ) {
      return tr.delete(block.parentPos, block.parentPos + block.parent.nodeSize);
    }
    return tr.delete(block.pos, end);
  }

  const shaped = adaptForParent(
    { type: block.parent.type.name },
    op.blocks ?? [],
  );
  const nodes = shaped.map((json, index) =>
    state.schema.nodeFromJSON(
      op.op === "replace" && index === 0
        ? { ...json, attrs: { ...(json.attrs ?? {}), id: op.blockId } }
        : json,
    ),
  );
  if (nodes.length === 0) return null;
  return op.op === "replace"
    ? tr.replaceWith(block.pos, end, nodes)
    : tr.insert(end, nodes);
}
