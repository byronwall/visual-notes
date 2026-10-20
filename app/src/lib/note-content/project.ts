import { hasBlockId } from "./block-ids";
import { hashNode } from "./ids";
import { nodeText } from "./markdown";
import type { NoteDoc, NoteNode } from "./types";

export type ProjectedBlock = {
  id: string;
  parentId: string | null;
  topLevelIndex: number;
  orderIndex: number;
  type: string;
  text: string;
  tags: string[];
  attrs: Record<string, unknown> | null;
  hash: string;
};

export type ProjectedLink = {
  sourceBlockId: string;
  targetDocId: string;
  targetBlockId: string | null;
};

export type ProjectedTask = { blockId: string; taskId: string; text: string };

export type NoteProjection = {
  blocks: ProjectedBlock[];
  links: ProjectedLink[];
  tasks: ProjectedTask[];
};

/** Attributes worth indexing (everything except the id and bulky content). */
function indexAttrs(node: NoteNode): Record<string, unknown> | null {
  if (!node.attrs) return null;
  const { id: _id, ...rest } = node.attrs;
  if (node.type === "image" && typeof rest.src === "string" && rest.src.startsWith("data:")) {
    rest.src = "data:…";
  }
  return Object.keys(rest).length ? rest : null;
}

function collectInline(
  node: NoteNode,
  onLink: (attrs: Record<string, any>) => void,
  onTag: (name: string) => void,
) {
  if (node.type === "noteLink" && node.attrs?.docId) onLink(node.attrs);
  if (node.type === "tag" && node.attrs?.name) onTag(String(node.attrs.name));
  for (const child of node.content ?? []) {
    // Nested id-bearing blocks report their own links and tags.
    if (hasBlockId(child.type)) continue;
    collectInline(child, onLink, onTag);
  }
}

/**
 * Flattens a note into index rows: every id-bearing block with its plain
 * text, plus the note links, tags, and task references each block holds.
 */
export function projectNote(doc: NoteDoc): NoteProjection {
  const blocks: ProjectedBlock[] = [];
  const links: ProjectedLink[] = [];
  const tasks: ProjectedTask[] = [];
  let order = 0;

  const visit = (node: NoteNode, parentId: string | null, top: number) => {
    let ownId = parentId;
    if (hasBlockId(node.type) && node.attrs?.id) {
      const id = String(node.attrs.id);
      const tags = new Set<string>();
      collectInline(
        node,
        (attrs) =>
          links.push({
            sourceBlockId: id,
            targetDocId: String(attrs.docId),
            targetBlockId: attrs.blockId ? String(attrs.blockId) : null,
          }),
        (name) => tags.add(name.toLowerCase()),
      );
      if (node.type === "taskRef" && node.attrs?.taskId) {
        tasks.push({
          blockId: id,
          taskId: String(node.attrs.taskId),
          text: nodeText(node).trim(),
        });
      }
      blocks.push({
        id,
        parentId,
        topLevelIndex: top,
        orderIndex: order++,
        type: node.type,
        text: nodeText(node),
        tags: [...tags],
        attrs: indexAttrs(node),
        hash: hashNode(node),
      });
      ownId = id;
    }
    for (const child of node.content ?? []) visit(child, ownId, top);
  };

  (doc.content ?? []).forEach((node, i) => visit(node, null, i));
  return { blocks, links, tasks };
}
