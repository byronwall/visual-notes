import { describe, expect, it } from "vitest";
import { hasDuplicateMetaKey, shouldSyncMetaDraft } from "./meta-draft";

describe("metadata draft state", () => {
  it("resets when the note changes even if its metadata is equal", () => {
    expect(shouldSyncMetaDraft("note-a", "note-b", "[]", "[]")).toBe(true);
    expect(shouldSyncMetaDraft("note-a", "note-a", "[]", "[]")).toBe(false);
    expect(shouldSyncMetaDraft("note-a", "note-a", "[]", '[["tag","x"]]')).toBe(
      true,
    );
  });

  it("detects keys that collide after trimming", () => {
    expect(
      hasDuplicateMetaKey([
        { key: " topic ", value: "one" },
        { key: "topic", value: "two" },
      ]),
    ).toBe(true);
    expect(hasDuplicateMetaKey([{ key: "topic", value: "one" }])).toBe(false);
  });
});
