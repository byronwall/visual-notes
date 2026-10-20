import { describe, expect, it } from "vitest";
import type { NotesChangedEvent } from "~/lib/note-events";
import {
  changeForNote,
  decideRemoteChange,
  shouldCheckRemote,
} from "./remote-note-change";

const T1 = "2026-10-19T12:00:00.000Z";
const T2 = "2026-10-19T12:00:05.000Z";

const event = (changes: NotesChangedEvent["changes"]): NotesChangedEvent => ({
  type: "notes:changed",
  changes,
  at: T2,
});

describe("changeForNote", () => {
  it("finds the open note's change", () => {
    expect(changeForNote(event([{ id: "a" }, { id: "b" }]), "b")).toEqual({
      id: "b",
    });
  });
  it("ignores events about other notes", () => {
    expect(changeForNote(event([{ id: "a" }]), "b")).toBeNull();
  });
  it("treats bulk writes as possibly this note", () => {
    expect(changeForNote(event(null), "b")).toBe("unknown");
  });
});

describe("shouldCheckRemote", () => {
  it("skips this tab's own save echoing back", () => {
    expect(shouldCheckRemote({ id: "a", updatedAt: T1 }, T1)).toBe(false);
    expect(shouldCheckRemote({ id: "a", updatedAt: T1 }, T2)).toBe(false);
  });
  it("checks newer, unstamped, deleted, and bulk changes", () => {
    expect(shouldCheckRemote({ id: "a", updatedAt: T2 }, T1)).toBe(true);
    expect(shouldCheckRemote({ id: "a" }, T2)).toBe(true);
    expect(shouldCheckRemote({ id: "a", deleted: true }, T2)).toBe(true);
    expect(shouldCheckRemote("unknown", T2)).toBe(true);
  });
});

describe("decideRemoteChange", () => {
  const base = { localUpdatedAt: T1, latestUpdatedAt: T2 };

  it("defers while a save is in flight, even with a newer copy", () => {
    expect(decideRemoteChange({ ...base, dirty: true, saving: true })).toBe(
      "defer",
    );
    expect(decideRemoteChange({ ...base, dirty: false, saving: true })).toBe(
      "defer",
    );
  });
  it("ignores a copy that is not newer", () => {
    expect(
      decideRemoteChange({
        localUpdatedAt: T2,
        latestUpdatedAt: T2,
        dirty: false,
        saving: false,
      }),
    ).toBe("ignore");
    expect(
      decideRemoteChange({
        localUpdatedAt: T2,
        latestUpdatedAt: T1,
        dirty: true,
        saving: false,
      }),
    ).toBe("ignore");
  });
  it("applies a newer copy when there are no local edits", () => {
    expect(decideRemoteChange({ ...base, dirty: false, saving: false })).toBe(
      "apply",
    );
  });
  it("asks before replacing unsaved edits", () => {
    expect(decideRemoteChange({ ...base, dirty: true, saving: false })).toBe(
      "conflict",
    );
  });
});
