import type { NoteChange, NotesChangedEvent } from "~/lib/note-events";
import { createBroadcastBus } from "./broadcast-bus";

const bus = createBroadcastBus<NotesChangedEvent>("notes-updates");

export const publishNoteChanges = (changes: NoteChange[] | null) => {
  if (changes && changes.length === 0) return;
  bus.publish({
    type: "notes:changed",
    changes,
    at: new Date().toISOString(),
  });
};

export const subscribeNoteChanges = bus.subscribe;
