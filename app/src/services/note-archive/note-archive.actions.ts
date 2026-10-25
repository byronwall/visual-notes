import { action } from "@solidjs/router";
import { z } from "zod";
import { archiveNotes, restoreNote } from "~/server/notes/note-archive";

const archiveInput = z.object({
  docIds: z.array(z.string().min(1)).min(1).max(200),
  intoId: z.string().min(1).nullish(),
  reason: z
    .enum(["distill", "combine", "post_event", "make_task", "delete", "manual"])
    .default("manual"),
});

export const archiveNotesAction = action(
  async (input: z.input<typeof archiveInput>) => {
    "use server";
    const parsed = archiveInput.parse(input);
    const archived = await archiveNotes(parsed);
    return { archived };
  },
  "note-archive-archive",
);

export const restoreNoteAction = action(async (docId: string) => {
  "use server";
  const restored = await restoreNote(z.string().min(1).parse(docId));
  if (!restored) throw new Error("Not archived");
  return { ok: true, id: docId };
}, "note-archive-restore");
