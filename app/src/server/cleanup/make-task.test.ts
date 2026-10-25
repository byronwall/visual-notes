import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", () => ({ prisma: {} }));
vi.mock("~/server/notes/note-archive", () => ({ archiveNotes: vi.fn() }));
vi.mock("~/server/notes/inline-tasks", () => ({ ensureInboxList: vi.fn() }));
vi.mock("~/server/tasks/task-store", () => ({ createTask: vi.fn() }));

import { taskLines } from "./make-task";

describe("taskLines", () => {
  it("prefers unchecked boxes and drops block id tags", () => {
    expect(
      taskLines(
        "- [ ] Call the bank ^abc123def\n\n- [x] Done already\n- [ ] Move the fund",
      ),
    ).toEqual(["Call the bank", "Move the fund"]);
  });

  it("falls back to short bullets", () => {
    expect(
      taskLines("Plan\n\n- Book the room\n- " + "word ".repeat(20)),
    ).toEqual(["Book the room"]);
  });
});
