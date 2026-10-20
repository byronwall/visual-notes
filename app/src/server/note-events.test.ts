import { describe, expect, it } from "vitest";
import type { NotesChangedEvent } from "~/lib/note-events";
import { publishNoteChanges, subscribeNoteChanges } from "./note-events";

describe("note events", () => {
  it("publishes changes and skips empty change lists", () => {
    const events: NotesChangedEvent[] = [];
    const stop = subscribeNoteChanges((e) => events.push(e));
    publishNoteChanges([]);
    publishNoteChanges([{ id: "a" }]);
    publishNoteChanges(null);
    stop();
    expect(events.map((e) => e.changes)).toEqual([[{ id: "a" }], null]);
    expect(events.every((e) => e.type === "notes:changed")).toBe(true);
  });
});
