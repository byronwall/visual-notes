import { describe, expect, it } from "vitest";
import type { AppChangedEvent, NotesChangedEvent } from "~/lib/note-events";
import { publishAppChange, publishNoteChanges, subscribeNoteChanges } from "./note-events";

describe("note events", () => {
  it("publishes changes and skips empty change lists", () => {
    const events: (NotesChangedEvent | AppChangedEvent)[] = [];
    const stop = subscribeNoteChanges((e) => events.push(e));
    publishNoteChanges([]);
    publishNoteChanges([{ id: "a" }]);
    publishNoteChanges(null);
    stop();
    expect(events.map((e) => (e.type === "notes:changed" ? e.changes : "other"))).toEqual([[{ id: "a" }], null]);
  });

  it("publishes area changes on the same bus", () => {
    const events: (NotesChangedEvent | AppChangedEvent)[] = [];
    const stop = subscribeNoteChanges((e) => events.push(e));
    publishAppChange("research", []);
    publishAppChange("research", ["t1"]);
    publishAppChange("tasks", null);
    stop();
    expect(events).toEqual([
      expect.objectContaining({ type: "app:changed", area: "research", ids: ["t1"] }),
      expect.objectContaining({ type: "app:changed", area: "tasks", ids: null }),
    ]);
  });
});
