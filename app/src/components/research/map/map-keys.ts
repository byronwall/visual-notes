import type { MapLayout } from "./map-layout";
import type { MapTree } from "./map-model";

export type MapMove =
  | { to: string }
  | { toggle: string }
  | { activate: string }
  | null;

/**
 * What a key does at a node. The arrows are spatial: on the left side ← moves
 * away from the center, so a key always goes where its arrow points.
 */
export const mapMove = (
  key: string,
  id: string,
  tree: MapTree,
  layout: MapLayout,
  open: Set<string>,
  /** Branches a search holds open; they cannot close until it clears. */
  held: Set<string>,
): MapMove => {
  const node = tree.byId.get(id);
  const box = layout.byId.get(id);
  if (!node || !box) return null;
  if (key === "Home") return { to: tree.root.id };
  if (key === "End") return { to: layout.boxes[layout.boxes.length - 1].id };
  if (key === "Enter" || key === " ") return { activate: id };

  if (key === "ArrowUp" || key === "ArrowDown") {
    const peers = layout.boxes.filter(
      (peer) => peer.depth === box.depth && peer.side === box.side,
    );
    const at = peers.findIndex((peer) => peer.id === id);
    const next = peers[at + (key === "ArrowDown" ? 1 : -1)];
    return next ? { to: next.id } : null;
  }
  if (key !== "ArrowLeft" && key !== "ArrowRight") return null;

  if (node.kind === "root") {
    const side = key === "ArrowRight" ? "right" : "left";
    const first = node.children.find((kid) => kid.side === side);
    return first ? { to: first.id } : null;
  }
  const outward = (key === "ArrowRight") === (box.side === "right");
  const isOpen = open.has(id);
  if (outward) {
    if (!node.children.length) return null;
    return isOpen ? { to: node.children[0].id } : { toggle: id };
  }
  if (isOpen && node.children.length && !held.has(id)) return { toggle: id };
  return node.parentId ? { to: node.parentId } : null;
};
