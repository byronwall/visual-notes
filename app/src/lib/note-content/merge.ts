import { hashNode } from "./ids";
import type { NoteDoc, NoteNode } from "./types";

export type MergeInput = {
  /** Hash of each top-level block as the saving client last saw it. */
  baseHashes: Record<string, string>;
  /** The client's document being saved. */
  mine: NoteDoc;
  /** The document currently stored (changed since the client's base). */
  theirs: NoteDoc;
};

export type MergeResult = {
  doc: NoteDoc;
  /** Ids changed differently on both sides; the incoming version won. */
  conflicts: string[];
};

const idOf = (node: NoteNode): string | null =>
  typeof node.attrs?.id === "string" && node.attrs.id ? node.attrs.id : null;

/**
 * Three-way merge over top-level blocks keyed by block id:
 * - changed on one side only → that side;
 * - changed differently on both → the incoming save wins (reported);
 * - deleted on one side, edited on the other → the edit survives;
 * - new blocks from the stored side go after their nearest surviving
 *   predecessor; the incoming document's order is the base order.
 */
export function mergeTopLevel({ baseHashes, mine, theirs }: MergeInput): MergeResult {
  const mineBlocks = mine.content ?? [];
  const theirsBlocks = theirs.content ?? [];
  const theirsById = new Map<string, NoteNode>();
  for (const node of theirsBlocks) {
    const id = idOf(node);
    if (id) theirsById.set(id, node);
  }
  const mineIds = new Set(mineBlocks.map(idOf).filter(Boolean) as string[]);
  const conflicts: string[] = [];

  const changedFromBase = (id: string, node: NoteNode) =>
    !(id in baseHashes) || hashNode(node) !== baseHashes[id];

  const result: NoteNode[] = [];
  for (const node of mineBlocks) {
    const id = idOf(node);
    if (!id) {
      result.push(node);
      continue;
    }
    const other = theirsById.get(id);
    const inBase = id in baseHashes;
    const mineChanged = changedFromBase(id, node);
    if (!other) {
      // Absent from the stored doc: deleted there, or new here.
      if (!inBase || mineChanged) result.push(node);
      continue;
    }
    const theirsChanged = changedFromBase(id, other);
    if (mineChanged && theirsChanged && hashNode(node) !== hashNode(other)) {
      conflicts.push(id);
      result.push(node);
    } else if (theirsChanged && !mineChanged) {
      result.push(other);
    } else {
      result.push(node);
    }
  }

  // Blocks only in the stored doc: added there, or deleted here.
  theirsBlocks.forEach((node, index) => {
    const id = idOf(node);
    if (!id || mineIds.has(id)) return;
    const inBase = id in baseHashes;
    if (inBase && !changedFromBase(id, node)) return; // deleted here, untouched there
    let insertAt = 0;
    for (let i = index - 1; i >= 0; i--) {
      const prevId = idOf(theirsBlocks[i]);
      const at = prevId ? result.findIndex((n) => idOf(n) === prevId) : -1;
      if (at >= 0) {
        insertAt = at + 1;
        break;
      }
    }
    result.splice(insertAt, 0, node);
  });

  return { doc: { ...mine, content: result }, conflicts };
}
