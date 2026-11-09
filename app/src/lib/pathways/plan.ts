import { newNodeId } from "./graph-ops";
import type { PathwayGraph, PathwayPlan, PlanTask } from "./types";

export type NewPlanTask = Pick<
  PlanTask,
  "title" | "why" | "doneWhen" | "minutes" | "nodeIds"
>;

/**
 * A new plan: fresh open tasks, plus finished tasks from the old plan as
 * history. Card ids that are not on the map are dropped from each task.
 */
export function replacePlan(
  graph: PathwayGraph,
  old: PathwayPlan | null,
  summary: string,
  tasks: NewPlanTask[],
): PathwayPlan {
  const ids = new Set(graph.nodes.map((n) => n.id));
  return {
    createdAt: new Date().toISOString(),
    summary,
    tasks: [
      ...tasks.map((t) => ({
        id: newNodeId(),
        title: t.title.trim(),
        why: t.why.trim(),
        doneWhen: t.doneWhen.trim(),
        minutes: Math.max(5, Math.round(t.minutes)),
        nodeIds: t.nodeIds.filter((id) => ids.has(id)),
        status: "todo" as const,
        result: "",
      })),
      ...(old?.tasks ?? []).filter((t) => t.status !== "todo"),
    ],
  };
}

/** Cards with two or more incoming edges: where paths meet. */
export function meetingPoints(graph: PathwayGraph) {
  const deg = new Map<string, number>();
  for (const e of graph.edges) deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
  return [...deg]
    .filter(([, n]) => n > 1)
    .map(([id, paths]) => ({ id, paths }));
}
