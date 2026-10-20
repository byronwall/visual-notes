import { generateBlockId, hasBlockId } from "./block-ids";
import type { NoteDoc, NoteNode } from "./types";

/**
 * Gives every id-bearing block a unique id, keeping the first occurrence of
 * each existing id. Returns a new document; the input is not mutated.
 */
export function assignBlockIds(doc: NoteDoc): NoteDoc {
  const seen = new Set<string>();
  const visit = (node: NoteNode): NoteNode => {
    let next = node;
    if (hasBlockId(node.type)) {
      const id = node.attrs?.id;
      if (typeof id === "string" && id && !seen.has(id)) {
        seen.add(id);
      } else {
        const fresh = generateBlockId();
        seen.add(fresh);
        next = { ...node, attrs: { ...(node.attrs ?? {}), id: fresh } };
      }
    }
    if (!next.content) return next;
    return { ...next, content: next.content.map(visit) };
  };
  return visit(doc) as NoteDoc;
}

/** Deterministic 53-bit string hash (cyrb53), identical on client and server. */
export function hashString(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export const hashNode = (node: NoteNode) => hashString(JSON.stringify(node));

/** Hash of each top-level block keyed by its id (blocks without ids skipped). */
export function topLevelHashes(doc: NoteDoc): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of doc.content ?? []) {
    const id = node.attrs?.id;
    if (typeof id === "string" && id) out[id] = hashNode(node);
  }
  return out;
}
