import { describe, expect, it } from "vitest";
import { replacePlan } from "./plan";
import { emptyGraph, type PlanTask } from "./types";

const step = (id: string, extra: Partial<PlanTask> = {}): PlanTask => ({
  id,
  title: id,
  why: "",
  doneWhen: "",
  minutes: 10,
  nodeIds: [],
  status: "todo",
  result: "",
  ...extra,
});

describe("replacePlan", () => {
  it("keeps finished and exported steps, drops other open ones", () => {
    const old = {
      createdAt: "",
      summary: "",
      tasks: [
        step("open"),
        step("done", { status: "done" }),
        // Exported: the real task may be complete even though this says todo.
        step("exported", { taskId: "t1" }),
      ],
    };
    const next = replacePlan(emptyGraph("Q"), old, "s", [
      { title: "New", why: "", doneWhen: "", minutes: 5, nodeIds: [] },
    ]);
    expect(next.tasks.map((t) => t.title)).toEqual([
      "New",
      "done",
      "exported",
    ]);
  });
});
