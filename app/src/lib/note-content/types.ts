/** A ProseMirror/TipTap JSON node as stored in Doc.content. */
export type NoteNode = {
  type: string;
  attrs?: Record<string, any>;
  content?: NoteNode[];
  marks?: { type: string; attrs?: Record<string, any> }[];
  text?: string;
};

export type NoteDoc = NoteNode & { type: "doc"; content?: NoteNode[] };

export const emptyNoteDoc = (): NoteDoc => ({
  type: "doc",
  content: [{ type: "paragraph" }],
});

export function isNoteDoc(value: unknown): value is NoteDoc {
  return (
    !!value &&
    typeof value === "object" &&
    (value as { type?: unknown }).type === "doc"
  );
}
