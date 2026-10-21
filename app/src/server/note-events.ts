import type {
  AppArea,
  AppChangedEvent,
  NoteChange,
  NotesChangedEvent,
} from "~/lib/note-events";
import { createBroadcastBus } from "./broadcast-bus";

const bus = createBroadcastBus<NotesChangedEvent | AppChangedEvent>("notes-updates");

export const publishNoteChanges = (changes: NoteChange[] | null) => {
  if (changes && changes.length === 0) return;
  bus.publish({
    type: "notes:changed",
    changes,
    at: new Date().toISOString(),
  });
};

export const subscribeNoteChanges = bus.subscribe;

/** Tells open tabs that research topics, tasks, or collections changed. */
export const publishAppChange = (area: AppArea, ids: string[] | null) => {
  if (ids && ids.length === 0) return;
  bus.publish({ type: "app:changed", area, ids, at: new Date().toISOString() });
};
