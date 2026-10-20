import { describe, expect, it } from "vitest";
import { noteChangesFor } from "./note-change-extension";

const at = new Date("2026-10-19T12:00:00.000Z");

describe("noteChangesFor", () => {
  it("ignores reads", () => {
    expect(noteChangesFor("findMany", {}, [])).toBeUndefined();
    expect(noteChangesFor("findUnique", {}, null)).toBeUndefined();
    expect(noteChangesFor("count", {}, 3)).toBeUndefined();
  });

  it("reports the id and updatedAt of a created or updated note", () => {
    expect(noteChangesFor("create", {}, { id: "a", updatedAt: at })).toEqual([
      { id: "a", updatedAt: at.toISOString() },
    ]);
    expect(
      noteChangesFor(
        "update",
        { where: { id: "b" } },
        { id: "b", updatedAt: at },
      ),
    ).toEqual([{ id: "b", updatedAt: at.toISOString() }]);
    expect(noteChangesFor("upsert", {}, { id: "c", updatedAt: at })).toEqual([
      { id: "c", updatedAt: at.toISOString() },
    ]);
  });

  it("falls back to where.id when select omits the id", () => {
    expect(
      noteChangesFor("update", { where: { id: "d" } }, { title: "x" }),
    ).toEqual([{ id: "d" }]);
  });

  it("publishes refresh-everything when the id is unknown", () => {
    expect(
      noteChangesFor("update", { where: { path: "p" } }, { title: "x" }),
    ).toBeNull();
  });

  it("marks deletes", () => {
    expect(
      noteChangesFor(
        "delete",
        { where: { id: "e" } },
        { id: "e", updatedAt: at },
      ),
    ).toEqual([{ id: "e", deleted: true }]);
  });

  it("treats bulk writes as unknown ids, and empty ones as no change", () => {
    expect(noteChangesFor("updateMany", {}, { count: 4 })).toBeNull();
    expect(noteChangesFor("deleteMany", {}, { count: 2 })).toBeNull();
    expect(noteChangesFor("createMany", {}, { count: 0 })).toEqual([]);
  });

  it("reads ids from returning bulk writes", () => {
    expect(
      noteChangesFor("createManyAndReturn", {}, [
        { id: "f", updatedAt: at },
        { id: "g", updatedAt: at },
      ]),
    ).toEqual([
      { id: "f", updatedAt: at.toISOString() },
      { id: "g", updatedAt: at.toISOString() },
    ]);
  });
});
