import { describe, expect, it, vi } from "vitest";
import type { NoteDoc } from "~/lib/note-content/types";

const findMany = vi.fn();
vi.mock("~/server/db", () => ({ prisma: { taskItem: { findMany } } }));

const { reportNoteTasks } = await import("./note-write-tasks");

const taskLine = (taskId: string) => ({ type: "taskRef", attrs: { taskId } });
const doc = (...ids: string[]): NoteDoc => ({ type: "doc", content: ids.map(taskLine) });

describe("reportNoteTasks", () => {
  it("says nothing for a note without task lines", async () => {
    expect(await reportNoteTasks(null, doc())).toEqual({});
  });

  it("lists task lines with their stored day and marks new ones", async () => {
    findMany.mockResolvedValue([
      { id: "a", description: "Replace motor", status: "waiting", dueDate: new Date("2026-10-22T00:00:00Z") },
      { id: "b", description: "Buy part", status: "complete", dueDate: null },
    ]);
    const report = await reportNoteTasks(doc("a"), doc("a", "b"));
    expect(report.tasks).toEqual([
      { id: "a", description: "Replace motor", status: "waiting", dueDate: "2026-10-22", created: false },
      { id: "b", description: "Buy part", status: "complete", dueDate: null, created: true },
    ]);
    expect(report.notice).toBeUndefined();
  });

  it("warns when one write files a procedure as many Inbox tasks", async () => {
    const ids = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"];
    findMany.mockResolvedValue(ids.map((id) => ({ id, description: id, status: "waiting", dueDate: null })));
    const report = await reportNoteTasks(null, doc(...ids));
    expect(report.tasks).toHaveLength(9);
    expect(report.notice).toMatch(/added 9 tasks.*numbered list/);
  });
});
