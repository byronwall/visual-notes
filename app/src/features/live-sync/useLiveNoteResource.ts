import { useRemoteNoteChanges } from "./useRemoteNoteChanges";
import { decideRemoteChange, shouldCheckRemote } from "./remote-note-change";

type Versioned = { id: string; updatedAt?: string };

/** Everything but the content and timestamps, which change on every save. */
const headerFields = (doc: object) => {
  const rest: Record<string, unknown> = { ...doc };
  delete rest.html;
  delete rest.markdown;
  delete rest.content;
  delete rest.contentVersion;
  delete rest.updatedAt;
  return rest;
};

const later = (a?: string, b?: string) => {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
};

/**
 * Refreshes a note resource that holds no unsaved edits (title, path, meta
 * headers) when the note changes elsewhere. It swaps data with `mutate`
 * rather than `refetch`, so Suspense never unmounts the open editor below,
 * and only when header fields differ: content belongs to the editor, and
 * handing the page a new note object on every save steals the editor's focus.
 */
export function useLiveNoteResource<T extends Versioned>(opts: {
  docId: () => string | undefined;
  current: () => T | undefined;
  load: (id: string) => Promise<T>;
  mutate: (next: T) => void;
}) {
  // Newest version already checked, including this tab's own saves, which
  // never reach this resource's updatedAt.
  let seenUpdatedAt: string | undefined;
  let seenForId: string | undefined;

  const knownUpdatedAt = (id: string) =>
    later(
      opts.current()?.updatedAt,
      seenForId === id ? seenUpdatedAt : undefined,
    );

  useRemoteNoteChanges(opts.docId, (change) => {
    if (change !== "unknown" && change.deleted) return;
    const id = opts.docId();
    if (!id || !shouldCheckRemote(change, knownUpdatedAt(id))) return;
    void (async () => {
      try {
        const latest = await opts.load(id);
        if (opts.docId() !== id || latest.id !== id) return;
        const decision = decideRemoteChange({
          localUpdatedAt: knownUpdatedAt(id),
          latestUpdatedAt: latest.updatedAt,
          dirty: false,
          saving: false,
        });
        seenForId = id;
        seenUpdatedAt = later(seenUpdatedAt, latest.updatedAt);
        if (decision !== "apply") return;
        const current = opts.current();
        const same =
          current &&
          JSON.stringify(headerFields(current)) ===
            JSON.stringify(headerFields(latest));
        if (!same) opts.mutate(latest);
      } catch (err) {
        console.warn("[note-live] could not refresh note details", { id, err });
      }
    })();
  });
}
