import { onCleanup } from "solid-js";
import type { NoteChange } from "~/lib/note-events";
import { useNoteLiveSync } from "./NoteLiveSyncProvider";
import { changeForNote } from "./remote-note-change";

/**
 * Calls `onChange` when a notes:changed event may concern the given note.
 * Does nothing outside the signed-in shell or when live sync is off.
 */
export function useRemoteNoteChanges(
  docId: () => string | undefined,
  onChange: (change: NoteChange | "unknown") => void,
) {
  const live = useNoteLiveSync();
  if (!live) return;
  const stop = live.onNotesChanged((event) => {
    const id = docId();
    if (!id) return;
    const change = changeForNote(event, id);
    if (change) onChange(change);
  });
  onCleanup(stop);
}
