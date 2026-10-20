/** One changed note. `updatedAt` is absent when the write did not return it. */
export type NoteChange = {
  id: string;
  updatedAt?: string;
  deleted?: boolean;
};

/**
 * A signal that notes changed. Clients re-run their own queries; the event
 * never carries note content. `changes: null` means a bulk write whose ids
 * are unknown, so every note view should refresh.
 */
export type NotesChangedEvent = {
  type: "notes:changed";
  changes: NoteChange[] | null;
  at: string;
};

/** Close code /ws/notes uses when NOTE_LIVE_SYNC=false; clients stop retrying. */
export const NOTE_SOCKET_DISABLED_CLOSE_CODE = 4503;

export type NoteSocketServerMessage =
  | NotesChangedEvent
  | { type: "notes:ping"; at: string };

export const isNoteSocketServerMessage = (
  value: unknown,
): value is NoteSocketServerMessage => {
  const type = (value as { type?: unknown } | null)?.type;
  return type === "notes:changed" || type === "notes:ping";
};
