import { describe, expect, it, vi } from "vitest";
import { createNoteMutations } from "./noteMutationAcknowledgements";

const createInput = { title: "A note", html: "<p>Body</p>" };
const updateInput = { id: "note-1", html: "<p>Updated</p>" };
const updatedAt = "2026-10-16T12:00:00.000Z";

describe("createNoteMutations", () => {
  it("returns valid action results unchanged", async () => {
    const created = { id: "note-2", updated: true };
    const updated = { id: updateInput.id, updatedAt };
    const deleted = { ok: true as const, id: updateInput.id };
    const actions = createNoteMutations({
      create: vi.fn(async () => created),
      update: vi.fn(async () => updated),
      delete: vi.fn(async () => deleted),
    });

    await expect(actions.create(createInput)).resolves.toBe(created);
    await expect(actions.update(updateInput)).resolves.toBe(updated);
    await expect(actions.delete(updateInput.id)).resolves.toBe(deleted);
  });

  it.each([undefined, "upstream failed", { id: "" }])(
    "rejects an invalid create acknowledgment: %s",
    async (result) => {
      const actions = createNoteMutations({
        create: vi.fn(async () => result),
        update: vi.fn(async () => ({ id: updateInput.id, updatedAt })),
        delete: vi.fn(async () => ({ ok: true, id: updateInput.id })),
      });

      await expect(actions.create(createInput)).rejects.toThrow(
        "Failed to create note",
      );
    },
  );

  it.each([
    undefined,
    "upstream failed",
    { id: "another-note", updatedAt },
    { id: updateInput.id, updatedAt: "not-a-date" },
  ])("rejects an invalid update acknowledgment: %s", async (result) => {
    const actions = createNoteMutations({
      create: vi.fn(async () => ({ id: "note-2" })),
      update: vi.fn(async () => result),
      delete: vi.fn(async () => ({ ok: true, id: updateInput.id })),
    });

    await expect(actions.update(updateInput)).rejects.toThrow(
      "Failed to save note",
    );
  });

  it.each([
    undefined,
    "upstream failed",
    { ok: true, id: "another-note" },
    { ok: false, id: updateInput.id },
  ])("rejects an invalid delete acknowledgment: %s", async (result) => {
    const actions = createNoteMutations({
      create: vi.fn(async () => ({ id: "note-2" })),
      update: vi.fn(async () => ({ id: updateInput.id, updatedAt })),
      delete: vi.fn(async () => result),
    });

    await expect(actions.delete(updateInput.id)).rejects.toThrow(
      "Failed to delete note",
    );
  });

  it("keeps action rejections unchanged", async () => {
    const failure = new Error("server rejected update");
    const actions = createNoteMutations({
      create: vi.fn(async () => Promise.reject(failure)),
      update: vi.fn(async () => Promise.reject(failure)),
      delete: vi.fn(async () => Promise.reject(failure)),
    });

    await Promise.all([
      expect(actions.create(createInput)).rejects.toBe(failure),
      expect(actions.update(updateInput)).rejects.toBe(failure),
      expect(actions.delete(updateInput.id)).rejects.toBe(failure),
    ]);
  });
});
