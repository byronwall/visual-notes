import type { NoteChange, NotesChangedEvent } from "~/lib/note-events";

/**
 * What a notes:changed event means for one open note: `null` when it does
 * not mention the note, `"unknown"` for a bulk write that might include it.
 */
export function changeForNote(
  event: NotesChangedEvent,
  docId: string,
): NoteChange | "unknown" | null {
  if (event.changes === null) return "unknown";
  return event.changes.find((change) => change.id === docId) ?? null;
}

const toTime = (iso?: string) => {
  if (!iso) return undefined;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? undefined : time;
};

const isNewer = (candidate?: string, local?: string) => {
  const a = toTime(candidate);
  const b = toTime(local);
  if (a === undefined) return true;
  if (b === undefined) return true;
  return a > b;
};

/**
 * Whether an event is worth fetching the note for. A change stamped no later
 * than the version on screen is this tab's own save echoing back.
 */
export function shouldCheckRemote(
  change: NoteChange | "unknown",
  localUpdatedAt?: string,
): boolean {
  if (change === "unknown") return true;
  if (change.deleted) return true;
  return isNewer(change.updatedAt, localUpdatedAt);
}

export type RemoteDecision = "ignore" | "defer" | "apply" | "conflict";

/**
 * Decides what to do with the latest server copy of the open note.
 * - ignore: not newer than what is on screen
 * - defer: a save is in flight; check again once it settles
 * - apply: no local edits, so swap the new content in
 * - conflict: unsaved local edits; ask before replacing them
 */
export function decideRemoteChange(input: {
  localUpdatedAt?: string;
  latestUpdatedAt?: string;
  dirty: boolean;
  saving: boolean;
}): RemoteDecision {
  if (input.saving) return "defer";
  if (!isNewer(input.latestUpdatedAt, input.localUpdatedAt)) return "ignore";
  return input.dirty ? "conflict" : "apply";
}
