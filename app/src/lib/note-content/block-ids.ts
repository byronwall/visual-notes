import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";

/** Node types that carry a stable block id. */
export const BLOCK_ID_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "listItem",
  "table",
  "image",
  "horizontalRule",
  "taskRef",
] as const;

const ID_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Short, markdown-safe id (letters and digits only). */
export function generateBlockId(): string {
  const bytes = new Uint8Array(10);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ID_ALPHABET[b % ID_ALPHABET.length];
  return out;
}

const blockIdsKey = new PluginKey("blockIds");

const blockIdTypes = new Set<string>(BLOCK_ID_TYPES);
export const hasBlockId = (typeName: string) => blockIdTypes.has(typeName);

/**
 * Keeps every block id present and unique inside one note. Unlike TipTap's
 * UniqueID, pasted blocks keep their ids, so a block cut from one note and
 * pasted into another stays linkable. A copy that duplicates an id already in
 * the note gets a fresh id; the block that was already there keeps its id.
 */
export const BlockIds = Extension.create({
  name: "blockIds",

  addGlobalAttributes() {
    return [
      {
        types: [...BLOCK_ID_TYPES],
        attributes: {
          id: {
            default: null,
            keepOnSplit: false,
            parseHTML: (element: HTMLElement) =>
              element.getAttribute("data-id"),
            renderHTML: (attributes: Record<string, unknown>) =>
              attributes.id ? { "data-id": attributes.id } : {},
          },
        },
      },
    ];
  },

  // Content loaded at creation never passes through appendTransaction, so
  // nudge one transaction through to give legacy blocks their ids.
  onCreate() {
    const { view, state } = this.editor;
    view.dispatch(state.tr.setMeta(blockIdsKey, "init"));
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: blockIdsKey,
        appendTransaction: (transactions, oldState, newState) => {
          const docChanged = transactions.some((tr) => tr.docChanged);
          const init = transactions.some((tr) => tr.getMeta(blockIdsKey));
          if (!docChanged && !init) return null;

          // Where each id lived before this change, mapped forward, so the
          // pre-existing block wins when a paste duplicates its id.
          const keeperPos = new Map<string, number>();
          if (docChanged) {
            oldState.doc.descendants((node, pos) => {
              const id = node.attrs?.id;
              if (!id || !hasBlockId(node.type.name)) return;
              let mapped = pos;
              for (const tr of transactions) mapped = tr.mapping.map(mapped);
              keeperPos.set(id, mapped);
            });
          }

          const tr = newState.tr;
          const seen = new Map<string, number>();
          const fixes: { pos: number; node: PMNode }[] = [];
          newState.doc.descendants((node, pos) => {
            if (!hasBlockId(node.type.name)) return;
            const id = node.attrs.id as string | null;
            if (!id) {
              fixes.push({ pos, node });
              return;
            }
            const prior = seen.get(id);
            if (prior === undefined) {
              seen.set(id, pos);
              return;
            }
            // Duplicate: the node at the id's old position keeps it.
            if (keeperPos.get(id) === pos) {
              const priorNode = newState.doc.nodeAt(prior);
              if (priorNode) fixes.push({ pos: prior, node: priorNode });
              seen.set(id, pos);
            } else {
              fixes.push({ pos, node });
            }
          });
          if (fixes.length === 0) return null;
          for (const { pos, node } of fixes) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              id: generateBlockId(),
            });
          }
          tr.setMeta("addToHistory", false);
          // Ids given to freshly loaded content are not an edit.
          if (init && !docChanged) tr.setMeta("preventUpdate", true);
          return tr;
        },
      }),
    ];
  },
});
