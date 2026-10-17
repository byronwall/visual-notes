import { describe, expect, it } from "vitest";
import type { TaskItem } from "~/services/tasks/tasks.service";
import {
  buildOpenIndex,
  deleteTaskLocally,
  groupChildren,
  insertTaskLocally,
  isDescendantOf,
  moveTaskLocally,
} from "./taskTreeOps";

const task = (id: string, sortOrder: number, overrides: Partial<TaskItem> = {}): TaskItem => ({
  id,
  listId: "l",
  description: id,
  status: "waiting",
  dueDate: null,
  durationMinutes: null,
  tags: [],
  meta: null,
  parentTaskId: null,
  sortOrder,
  createdAt: "2026-10-16T00:00:00.000Z",
  updatedAt: "2026-10-16T00:00:00.000Z",
  ...overrides,
});

const order = (items: TaskItem[], parent: string | null = null) =>
  (groupChildren(items).get(parent) ?? []).map((item) => item.id);

const base = [task("a", 0), task("b", 1), task("c", 2), task("a1", 0, { parentTaskId: "a" })];

describe("moveTaskLocally", () => {
  it("moves down one slot with a pre-removal index of index + 2", () => {
    expect(order(moveTaskLocally(base, "a", null, 2))).toEqual(["b", "a", "c"]);
  });

  it("moves up one slot", () => {
    expect(order(moveTaskLocally(base, "c", null, 1))).toEqual(["a", "c", "b"]);
  });

  it("indents under a new parent", () => {
    const next = moveTaskLocally(base, "b", "a", 1);
    expect(order(next)).toEqual(["a", "c"]);
    expect(order(next, "a")).toEqual(["a1", "b"]);
  });
});

describe("insertTaskLocally", () => {
  it("inserts at the target index and reindexes siblings", () => {
    expect(order(insertTaskLocally(base, task("n", 0), 1))).toEqual(["a", "n", "b", "c"]);
  });
});

describe("deleteTaskLocally", () => {
  it("promotes children into the deleted task's slot", () => {
    expect(order(deleteTaskLocally(base, "a"))).toEqual(["a1", "b", "c"]);
  });
});

describe("tree helpers", () => {
  it("detects descendants", () => {
    const byId = new Map(base.map((item) => [item.id, item]));
    expect(isDescendantOf(byId, "a1", "a")).toBe(true);
    expect(isDescendantOf(byId, "a", "a1")).toBe(false);
  });

  it("treats a done parent with open children as open", () => {
    const items = [task("p", 0, { status: "complete" }), task("k", 0, { parentTaskId: "p" })];
    const hasOpen = buildOpenIndex(groupChildren(items));
    expect(hasOpen(items[0])).toBe(true);
  });

  it("renders orphans as roots", () => {
    expect(order([task("x", 0, { parentTaskId: "missing" })])).toEqual(["x"]);
  });
});
