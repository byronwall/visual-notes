import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { replacePlan } from "~/lib/pathways/plan";
import { emptyGraph } from "~/lib/pathways/types";
import {
  testDatabaseEnabled as enabled,
  testDatabaseUrl as url,
} from "~/test/database";

// Exported Next steps become linked real tasks, and the real task's status
// wins in both directions.

const { client: db } = vi.hoisted(() => ({
  client: { current: null as PrismaClient | null },
}));
vi.mock("~/server/db", () => ({
  get prisma() {
    return db.current;
  },
}));
vi.mock("~/server/events/action-events", () => ({ logActionEvent: vi.fn() }));

const store = await import("./pathway-store");
const links = await import("./pathway-tasks");

describe.skipIf(!enabled)("pathway tasks (database)", () => {
  db.current = enabled
    ? new PrismaClient({ datasources: { db: { url } } })
    : null;
  const prisma = () => db.current!;
  let pathwayId = "";
  let listId = "";

  afterAll(async () => {
    if (!db.current) return;
    if (pathwayId) await prisma().pathway.delete({ where: { id: pathwayId } });
    if (listId) await prisma().taskList.delete({ where: { id: listId } });
    await prisma().$disconnect();
  });

  it("exports a step to a list, mirrors its status, and writes status back", async () => {
    listId = (
      await prisma().taskList.create({
        data: { name: `pathway-export-${Date.now()}` },
      })
    ).id;
    const graph = emptyGraph("Where should it live?");
    const p = await store.createPathway({
      title: "Where should it live?",
      graph,
      plan: replacePlan(graph, null, "Start small", [
        {
          title: "Sketch the store",
          why: "Both paths need it",
          doneWhen: "Schema written",
          minutes: 30,
          nodeIds: ["root"],
        },
        {
          title: "Ask Matt",
          why: "Cheap info",
          doneWhen: "Sent",
          minutes: 5,
          nodeIds: [],
        },
      ]),
    });
    pathwayId = p.id;
    const [first, second] = p.plan!.tasks;

    const view = await links.exportPlanTasks(p.id, [first.id], listId);
    const exported = view.plan!.tasks.find((t) => t.id === first.id)!;
    expect(exported.taskId).toBeTruthy();
    expect(
      view.plan!.tasks.find((t) => t.id === second.id)!.taskId,
    ).toBeUndefined();
    const task = await prisma().taskItem.findUniqueOrThrow({
      where: { id: exported.taskId! },
    });
    expect(task).toMatchObject({
      listId,
      description: "Sketch the store",
      durationMinutes: 30,
    });
    expect(await links.pathwaysForTasks([task.id])).toEqual({
      [task.id]: [{ id: p.id, title: "Where should it live?" }],
    });

    // Checked off on the Tasks page: the map shows it done.
    await prisma().taskItem.update({
      where: { id: task.id },
      data: { status: "complete" },
    });
    const mirrored = await links.withLinkedStatus(
      (await store.getPathway(p.id))!,
    );
    expect(mirrored.plan!.tasks.find((t) => t.id === first.id)!.status).toBe(
      "done",
    );

    // Unchecked in Next steps: the real task goes back to waiting.
    await links.updatePlanTask(p.id, first.id, { status: "todo" });
    expect(
      (await prisma().taskItem.findUniqueOrThrow({ where: { id: task.id } }))
        .status,
    ).toBe("waiting");

    // Deleted on the Tasks page: the step can be exported again.
    await prisma().taskItem.delete({ where: { id: task.id } });
    const again = await links.exportPlanTasks(p.id, [first.id], listId);
    const redone = again.plan!.tasks.find((t) => t.id === first.id)!.taskId;
    expect(redone).toBeTruthy();
    expect(redone).not.toBe(task.id);
  });

  it("never exports a step twice, through undo or at the same time", async () => {
    const graph = emptyGraph("Which bike?");
    const p = await store.createPathway({
      title: "Which bike?",
      graph,
      plan: replacePlan(graph, null, "", [
        { title: "Test ride", why: "", doneWhen: "", minutes: 60, nodeIds: [] },
        {
          title: "Check racks",
          why: "",
          doneWhen: "",
          minutes: 10,
          nodeIds: [],
        },
      ]),
    });
    const [first, second] = p.plan!.tasks;
    const count = (planTaskId: string) =>
      prisma().pathwayTaskLink.count({
        where: { pathwayId: p.id, planTaskId },
      });
    try {
      // Two exports at once make one task.
      await Promise.all([
        links.exportPlanTasks(p.id, [first.id], listId),
        links.exportPlanTasks(p.id, [first.id], listId),
      ]);
      expect(await count(first.id)).toBe(1);

      // Undo of the export keeps the link, so exporting again reuses it.
      const [link] = await prisma().pathwayTaskLink.findMany({
        where: { pathwayId: p.id },
      });
      await links.undoWithTasks(p.id);
      const view = await links.withLinkedStatus(
        (await store.getPathway(p.id))!,
      );
      expect(view.plan!.tasks.find((t) => t.id === first.id)!.taskId).toBe(
        link.taskId,
      );
      await links.exportPlanTasks(p.id, [first.id, second.id], listId);
      expect(await count(first.id)).toBe(1);
      expect(await count(second.id)).toBe(1);

      // Undo of a check-off reopens the real task.
      await links.updatePlanTask(p.id, first.id, { status: "done" });
      const status = async () =>
        (
          await prisma().taskItem.findUniqueOrThrow({
            where: { id: link.taskId },
          })
        ).status;
      expect(await status()).toBe("complete");
      await links.undoWithTasks(p.id);
      expect(await status()).toBe("waiting");

      // A task changed on the Tasks page after the check-off keeps its status.
      await links.updatePlanTask(p.id, first.id, { status: "done" });
      await prisma().taskItem.update({
        where: { id: link.taskId },
        data: { status: "cancelled" },
      });
      await links.undoWithTasks(p.id);
      expect(await status()).toBe("cancelled");
    } finally {
      await prisma().pathway.delete({ where: { id: p.id } });
    }
  });
});
