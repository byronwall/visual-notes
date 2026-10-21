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

/** Non-note areas that agents and other tabs change. */
export const APP_AREAS = [
  "research",
  "tasks",
  "collections",
  "time-blocks",
  "archive",
  "events",
] as const;
export type AppArea = (typeof APP_AREAS)[number];

/**
 * A signal that records in one area changed. `ids` names the topics, task
 * lists, or collections touched; `null` means "refresh the whole area".
 */
export type AppChangedEvent = {
  type: "app:changed";
  area: AppArea;
  ids: string[] | null;
  at: string;
};

/** Close code /ws/notes uses when NOTE_LIVE_SYNC=false; clients stop retrying. */
export const NOTE_SOCKET_DISABLED_CLOSE_CODE = 4503;

export type NoteSocketServerMessage =
  | NotesChangedEvent
  | AppChangedEvent
  | { type: "notes:ping"; at: string };

export const isNoteSocketServerMessage = (
  value: unknown,
): value is NoteSocketServerMessage => {
  const type = (value as { type?: unknown } | null)?.type;
  return (
    type === "notes:changed" || type === "app:changed" || type === "notes:ping"
  );
};
