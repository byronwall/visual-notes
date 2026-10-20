import { describe, expect, it } from "vitest";
import {
  deferNoteChanges,
  mergeNoteChanges,
  noteChangesFor,
  recordNoteWrite,
} from "./note-change-extension";

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

describe("deferNoteChanges", () => {
  it("publishes one merged event after the transaction resolves", async () => {
    const published: unknown[] = [];
    let insideBeforeResolve: unknown[] = [];
    expect(
      mergeNoteChanges([
        [{ id: "a", updatedAt: "1" }],
        [{ id: "a", updatedAt: "2" }, { id: "b" }],
      ]),
    ).toEqual([{ id: "a", updatedAt: "2" }, { id: "b" }]);
    expect(mergeNoteChanges([[{ id: "a" }], null])).toBeNull();

    const result = await deferNoteChanges(
      async () => {
        insideBeforeResolve = [...published];
        return "ok";
      },
      (changes) => published.push(changes),
    );
    expect(result).toBe("ok");
    expect(insideBeforeResolve).toEqual([]);
    // No writes inside, so nothing to publish.
    expect(published).toEqual([]);
  });

  it("publishes nothing when the transaction rejects", async () => {
    const published: unknown[] = [];
    await expect(
      deferNoteChanges(
        async () => {
          throw new Error("rolled back");
        },
        (changes) => published.push(changes),
      ),
    ).rejects.toThrow("rolled back");
    expect(published).toEqual([]);
  });
});

describe("recordNoteWrite", () => {
  it("publishes right away outside a transaction", () => {
    const published: unknown[] = [];
    recordNoteWrite("update", { where: { id: "a" } }, { id: "a" }, (c) =>
      published.push(c),
    );
    recordNoteWrite("findMany", {}, [], (c) => published.push(c));
    expect(published).toEqual([[{ id: "a" }]]);
  });

  it("holds writes inside a transaction until it commits", async () => {
    const published: unknown[] = [];
    const publish = (c: unknown) => published.push(c);
    let seenInside: unknown[] = [];
    await deferNoteChanges(async () => {
      recordNoteWrite("update", { where: { id: "a" } }, { id: "a" }, publish);
      await Promise.resolve();
      recordNoteWrite("create", {}, { id: "b" }, publish);
      seenInside = [...published];
    }, publish);
    expect(seenInside).toEqual([]);
    expect(published).toEqual([[{ id: "a" }, { id: "b" }]]);
  });

  it("drops writes from a rolled-back transaction", async () => {
    const published: unknown[] = [];
    const publish = (c: unknown) => published.push(c);
    await expect(
      deferNoteChanges(async () => {
        recordNoteWrite("update", { where: { id: "a" } }, { id: "a" }, publish);
        throw new Error("rolled back");
      }, publish),
    ).rejects.toThrow();
    expect(published).toEqual([]);
  });
});
