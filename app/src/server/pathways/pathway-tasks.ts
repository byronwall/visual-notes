import type { TaskStatus } from "@prisma/client";
import type { PlanTask } from "~/lib/pathways/types";
import { prisma } from "~/server/db";
import { publishAppChange } from "~/server/note-events";
import { ensureInboxList } from "~/server/notes/inline-tasks";
import * as tasks from "~/server/tasks/task-store";
import * as store from "./pathway-store";

// Next steps ↔ real tasks. Only the steps the person exports become tasks;
// each export is a PathwayTaskLink, and the real task's status wins: a
// complete task shows done, a cancelled one skipped.

const fromTask = (status: TaskStatus): PlanTask["status"] =>
  status === "complete" ? "done" : status === "cancelled" ? "skipped" : "todo";
const toTask = (status: PlanTask["status"]): TaskStatus =>
  status === "done"
    ? "complete"
    : status === "skipped"
      ? "cancelled"
      : "waiting";

export type LinkedTask = {
  id: string;
  status: TaskStatus;
  listId: string;
  list: string;
};

/** The record with each exported step's status taken from its real task. */
export async function withLinkedStatus(p: store.PathwayRecord) {
  const ids = (p.plan?.tasks ?? []).flatMap((t) =>
    t.taskId ? [t.taskId] : [],
  );
  if (!ids.length) return { ...p, linked: {} as Record<string, LinkedTask> };
  const rows = await prisma.taskItem.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      status: true,
      listId: true,
      list: { select: { name: true } },
    },
  });
  const linked = Object.fromEntries(
    rows.map((r) => [
      r.id,
      { id: r.id, status: r.status, listId: r.listId, list: r.list.name },
    ]),
  );
  const plan = p.plan && {
    ...p.plan,
    tasks: p.plan.tasks.map((t) => {
      const real = t.taskId ? linked[t.taskId] : undefined;
      // A deleted task drops its link; the step keeps its own status.
      return real
        ? { ...t, status: fromTask(real.status) }
        : { ...t, taskId: undefined };
    }),
  };
  return { ...p, plan, linked };
}

export type PathwayView = Awaited<ReturnType<typeof withLinkedStatus>>;

/** Turns chosen Next steps into real tasks in one list, linked back to their cards. */
export async function exportPlanTasks(
  pathwayId: string,
  planTaskIds: string[],
  listId: string | null,
) {
  const p = await store.getPathway(pathwayId);
  if (!p?.plan) throw new Error(`Pathway ${pathwayId} has no Next steps`);
  const target = listId ?? (await ensureInboxList());
  const picked = p.plan.tasks.filter(
    (t) => planTaskIds.includes(t.id) && !t.taskId,
  );
  const made: { planTaskId: string; taskId: string; nodeIds: string[] }[] = [];
  for (const t of picked) {
    const created = await tasks.createTask({
      listId: target,
      description: t.title,
      durationMinutes: t.minutes,
      meta: {
        "pathway.why": t.why.slice(0, 4000),
        "pathway.doneWhen": t.doneWhen.slice(0, 4000),
      },
    });
    await prisma.pathwayTaskLink.create({
      data: {
        pathwayId,
        taskId: created.id,
        nodeIds: t.nodeIds,
        planTaskId: t.id,
      },
    });
    made.push({ planTaskId: t.id, taskId: created.id, nodeIds: t.nodeIds });
  }
  const { record } = await store.writePathway(
    pathwayId,
    "you: export to tasks",
    (d) => {
      for (const m of made) {
        const t = d.plan?.tasks.find((x) => x.id === m.planTaskId);
        if (t) t.taskId = m.taskId;
      }
      d.exportListId = target;
    },
  );
  publishAppChange("tasks", [target]);
  console.info(
    "[pathways] exported %d steps from %s to list %s",
    made.length,
    pathwayId,
    target,
  );
  return withLinkedStatus(record);
}

/**
 * Updates one Next steps entry. A status change on an exported step also
 * changes its real task, so the Tasks page and the map agree.
 */
export async function updatePlanTask(
  pathwayId: string,
  planTaskId: string,
  patch: Partial<Pick<PlanTask, "status" | "result">>,
  coalesce?: string,
) {
  let taskId: string | undefined;
  const { record } = await store.writePathway(
    pathwayId,
    "you",
    (d) => {
      const t = d.plan?.tasks.find((x) => x.id === planTaskId);
      if (!t) throw new Error(`Next steps task ${planTaskId} not found`);
      if (patch.status) t.status = patch.status;
      if (patch.result !== undefined) t.result = patch.result;
      t.absorbed = false;
      taskId = t.taskId;
    },
    { coalesce },
  );
  if (patch.status && taskId) {
    const exists = await prisma.taskItem.findUnique({
      where: { id: taskId },
      select: { listId: true },
    });
    if (exists) {
      await tasks.updateTask({ id: taskId, status: toTask(patch.status) });
      publishAppChange("tasks", [exists.listId]);
    }
  }
  return withLinkedStatus(record);
}

/** Pathways that a task belongs to, for links on task rows. */
export async function pathwaysForTasks(taskIds: string[]) {
  if (!taskIds.length)
    return {} as Record<string, { id: string; title: string }[]>;
  const links = await prisma.pathwayTaskLink.findMany({
    where: { taskId: { in: taskIds }, pathway: { archivedAt: null } },
    select: { taskId: true, pathway: { select: { id: true, title: true } } },
  });
  const out: Record<string, { id: string; title: string }[]> = {};
  for (const l of links) (out[l.taskId] ??= []).push(l.pathway);
  return out;
}
