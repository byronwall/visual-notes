import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  testDatabaseEnabled as enabled,
  testDatabaseUrl as url,
} from "~/test/database";

// Starting a map from a task or a note: the source becomes the question (or
// the goals), the task links back, and a second start reopens the same map.

const { client: db } = vi.hoisted(() => ({
  client: { current: null as PrismaClient | null },
}));
vi.mock("~/server/db", () => ({
  get prisma() {
    return db.current;
  },
}));

const start = await import("./pathway-start");
const { contentColumns, prepareContent } = await import(
  "~/server/notes/note-store"
);
const store = await import("./pathway-store");

describe.skipIf(!enabled)("starting pathways (database)", () => {
  db.current = enabled
    ? new PrismaClient({ datasources: { db: { url } } })
    : null;
  const prisma = () => db.current!;
  const pathwayIds: string[] = [];
  let listId = "";
  let docId = "";

  afterAll(async () => {
    if (!db.current) return;
    await prisma().pathway.deleteMany({ where: { id: { in: pathwayIds } } });
    if (listId) await prisma().taskList.delete({ where: { id: listId } });
    if (docId) await prisma().doc.delete({ where: { id: docId } });
    await prisma().$disconnect();
  });

  it("maps a task once and links it back", async () => {
    listId = (
      await prisma().taskList.create({
        data: { name: `pathway-start-${Date.now()}` },
      })
    ).id;
    const task = await prisma().taskItem.create({
      data: { listId, description: "Decide whether to rebuild the office" },
    });
    const first = await start.startFromTask(task.id);
    pathwayIds.push(first.id);
    expect(first.created).toBe(true);
    expect((await store.getPathway(first.id))!.title).toBe(
      "Decide whether to rebuild the office",
    );
    expect(
      await prisma().pathwayTaskLink.count({
        where: { taskId: task.id, pathwayId: first.id },
      }),
    ).toBe(1);
    expect(await start.startFromTask(task.id)).toEqual({
      id: first.id,
      created: false,
    });
  });

  it("maps a note with its text in Goals & vibes", async () => {
    docId = (
      await prisma().doc.create({
        data: {
          title: "Indy follow-ups",
          ...contentColumns(
            prepareContent({ markdown: "Ask Matt for names.\n\nThank Scott." }),
          ),
        },
      })
    ).id;
    const made = await start.startFromNote(docId);
    pathwayIds.push(made.id);
    const p = (await store.getPathway(made.id))!;
    expect(p.title).toBe("What do I do with “Indy follow-ups”?");
    expect(p.sourceDocId).toBe(docId);
    expect(p.context?.notes).toContain("Ask Matt for names.");
    expect((await start.startFromNote(docId)).created).toBe(false);
  });
});
