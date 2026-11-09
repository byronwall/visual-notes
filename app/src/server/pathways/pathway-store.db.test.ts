import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { applyOps } from "~/lib/pathways/graph-ops";
import {
  testDatabaseEnabled as enabled,
  testDatabaseUrl as url,
} from "~/test/database";

// Writes save a revision first, the root card names the pathway, and undo
// walks back one write at a time.

const { client: db } = vi.hoisted(() => ({
  client: { current: null as PrismaClient | null },
}));
vi.mock("~/server/db", () => ({
  get prisma() {
    return db.current;
  },
}));

const store = await import("./pathway-store");

describe.skipIf(!enabled)("pathway store (database)", () => {
  db.current = enabled
    ? new PrismaClient({ datasources: { db: { url } } })
    : null;
  const ids: string[] = [];

  afterAll(async () => {
    if (!db.current) return;
    await db.current.pathway.deleteMany({ where: { id: { in: ids } } });
    await db.current.$disconnect();
  });

  it("saves a revision per write and undoes them in order", async () => {
    const p = await store.createPathway({
      title: "Where should it live?",
      notes: "Fast to try",
    });
    ids.push(p.id);
    expect(p.context).toEqual({ notes: "Fast to try", qa: [] });

    const { record: one } = await store.writePathway(p.id, "you", (d) => {
      d.graph = applyOps(
        d.graph,
        {
          nodes: [{ ref: "n1", kind: "option", title: "Tasks page" }],
          edges: [{ from: "root", to: "n1" }],
        },
        "me",
      ).graph;
    });
    expect(one.graph.nodes).toHaveLength(2);

    const { record: two } = await store.writePathway(p.id, "you", (d) => {
      d.graph = applyOps(
        d.graph,
        { update: [{ id: "root", title: "Where should Pathways live?" }] },
        "me",
      ).graph;
    });
    expect(two.title).toBe("Where should Pathways live?");

    const back1 = await store.undoPathway(p.id);
    expect(back1?.record.title).toBe("Where should it live?");
    expect(back1?.record.graph.nodes).toHaveLength(2);
    const back2 = await store.undoPathway(p.id);
    expect(back2?.record.graph.nodes).toHaveLength(1);
    expect(await store.undoPathway(p.id)).toBeNull();
  });

  it("keeps both edits when two writes run at once", async () => {
    const p = await store.createPathway({ title: "Two tabs" });
    ids.push(p.id);
    const add = (title: string) =>
      store.writePathway(p.id, "you", (d) => {
        d.graph = applyOps(
          d.graph,
          { nodes: [{ ref: "n", kind: "option", title }] },
          "me",
        ).graph;
      });
    await Promise.all([add("A"), add("B"), add("C")]);
    const saved = await store.getPathway(p.id);
    expect(saved?.graph.nodes.map((n) => n.title).sort()).toEqual([
      "A",
      "B",
      "C",
      "Two tabs",
    ]);
  });
});
