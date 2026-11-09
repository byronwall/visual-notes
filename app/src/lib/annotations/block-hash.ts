import { noteSchema } from "~/lib/note-content/convert";
import { hashNode } from "~/lib/note-content/ids";
import type { NoteNode } from "~/lib/note-content/types";

/**
 * Hash of a block after a round trip through the headless note schema, so
 * stored JSON and the editor's JSON for the same block hash the same even
 * when one side omits default attributes.
 */
export function blockHash(node: NoteNode): string {
  try {
    return hashNode(noteSchema().nodeFromJSON(node).toJSON() as NoteNode);
  } catch {
    return hashNode(node);
  }
}
