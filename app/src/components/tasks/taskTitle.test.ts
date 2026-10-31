import { describe, expect, it } from "vitest";
import { formatDue, formatDuration, summarizeTasks } from "./taskFormat";
import { parseTaskInput, parseTaskTitle } from "./taskTitle";
import type { TaskItem } from "~/services/tasks/tasks.service";

// 2026-10-16 is a Friday.
const TODAY = "2026-10-16";

describe("parseTaskInput", () => {
  it("pulls tags, due, and duration tokens out of the title", () => {
    expect(parseTaskInput("Buy firewood #camp @tomorrow ~30m", TODAY)).toEqual({
      description: "Buy firewood",
      tags: ["camp"],
      dueDate: "2026-10-17",
      durationMinutes: 30,
    });
  });

  it("keeps extra lines and reads tokens from any line", () => {
    expect(
      parseTaskInput("Fix gate #home\n\n  ask about hinges  @tomorrow\n", TODAY),
    ).toEqual({
      description: "Fix gate\nask about hinges",
      tags: ["home"],
      dueDate: "2026-10-17",
      durationMinutes: undefined,
    });
  });

  it("resolves weekdays to the next occurrence, never today", () => {
    expect(parseTaskInput("Call @mon", TODAY).dueDate).toBe("2026-10-19");
    expect(parseTaskInput("Call @fri", TODAY).dueDate).toBe("2026-10-23");
    expect(parseTaskInput("Call @next-week", TODAY).dueDate).toBe("2026-10-19");
    expect(parseTaskInput("Call @2026-12-01", TODAY).dueDate).toBe("2026-12-01");
  });

  it("parses hour and mixed durations", () => {
    expect(parseTaskInput("Deep work ~1h30m", TODAY).durationMinutes).toBe(90);
    expect(parseTaskInput("Deep work ~1.5h", TODAY).durationMinutes).toBe(90);
    expect(parseTaskInput("Deep work ~45", TODAY).durationMinutes).toBe(45);
  });

  it("leaves unknown @words and inline emails alone", () => {
    const parsed = parseTaskInput("Email byron@example.com @someone", TODAY);
    expect(parsed.description).toBe("Email byron@example.com @someone");
    expect(parsed.dueDate).toBeUndefined();
    expect(parsed.durationMinutes).toBeUndefined();
  });

  it("matches the legacy title parser when no tokens are present", () => {
    expect(parseTaskInput("Fix porch #home #home", TODAY)).toEqual({
      ...parseTaskTitle("Fix porch #home #home"),
      dueDate: undefined,
      durationMinutes: undefined,
    });
  });
});

describe("formatDue", () => {
  it("labels nearby dates relatively", () => {
    expect(formatDue(TODAY, TODAY).label).toBe("Today");
    expect(formatDue("2026-10-17", TODAY).label).toBe("Tomorrow");
    expect(formatDue("2026-10-15", TODAY)).toMatchObject({
      label: "Yesterday",
      tone: "overdue",
    });
    expect(formatDue("2026-10-12", TODAY).label).toBe("4d overdue");
    expect(formatDue("2026-10-20", TODAY)).toMatchObject({ label: "Tue", tone: "soon" });
    expect(formatDue("2026-11-02", TODAY)).toMatchObject({ label: "Nov 2", tone: "later" });
  });

  it("does not flag finished work as overdue", () => {
    expect(formatDue("2026-10-12", TODAY, true)).toMatchObject({
      label: "Oct 12",
      tone: "done",
    });
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(15)).toBe("15m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(135)).toBe("2h 15m");
  });
});

describe("summarizeTasks", () => {
  const task = (overrides: Partial<TaskItem>): TaskItem => ({
    id: "t",
    listId: "l",
    description: "x",
    status: "waiting",
    dueDate: null,
    durationMinutes: null,
    tags: [],
    meta: null,
    parentTaskId: null,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  });

  it("counts open, done, overdue, and planned minutes", () => {
    expect(
      summarizeTasks(
        [
          task({ dueDate: "2026-10-10", durationMinutes: 30 }),
          task({ dueDate: TODAY, status: "started", durationMinutes: 15 }),
          task({ status: "complete", durationMinutes: 60, dueDate: "2026-10-01" }),
          task({ status: "cancelled" }),
        ],
        TODAY
      )
    ).toEqual({ open: 2, done: 2, overdue: 1, dueToday: 1, plannedMinutes: 45 });
  });
});
