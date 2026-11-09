import { PrismaClient } from "@prisma/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  testDatabaseEnabled as enabled,
  testDatabaseUrl as url,
} from "~/test/database";

// The pathway tools end to end: an agent starts a map from a task, branches
// it, joins two paths at one outcome, plans Next steps, and undoes a write.

const { client: db } = vi.hoisted(() => ({
  client: { current: null as PrismaClient | null },
}));
vi.mock("~/server/db", () => ({
  get prisma() {
    return db.current;
  },
}));
vi.mock("~/server/events/action-events", () => ({ logActionEvent: vi.fn() }));
vi.mock("~/features/docs-index/data/docs.queries.search", () => ({
  searchDocs: vi.fn(),
}));
vi.mock("./semantic", () => ({
  scheduleEmbeddingRefresh: vi.fn(),
  semanticSearch: vi.fn(),
}));

const { createNotesMcpServer } = await import("./tools");

const ctx = {
  origin: "https://notes.test",
  actorId: "claude:test",
  scopes: ["notes:read", "notes:write"],
  scopeChallenge: "",
};

type Json = Record<string, any>;

describe.skipIf(!enabled)("pathway tools (database)", () => {
  db.current = enabled
    ? new PrismaClient({ datasources: { db: { url } } })
    : null;
  const prisma = () => db.current!;
  const pathwayIds: string[] = [];
  let listId = "";

  const connect = async () => {
    const server = createNotesMcpServer(ctx);
    const client = new Client({ name: "pathways-test", version: "1.0.0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(b), client.connect(a)]);
    return client;
  };
  const call = async (client: Client, name: string, args: Json) => {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return {
      error: Boolean(result.isError),
      text,
      json: result.isError ? null : (JSON.parse(text) as Json),
    };
  };

  afterAll(async () => {
    if (!db.current) return;
    await prisma().pathway.deleteMany({ where: { id: { in: pathwayIds } } });
    if (listId) await prisma().taskList.delete({ where: { id: listId } });
    await prisma().$disconnect();
  });

  it("creates from a task, branches, joins paths, plans, and undoes", async () => {
    const list = await prisma().taskList.create({
      data: { name: `pathways-test-${Date.now()}` },
    });
    listId = list.id;
    const task = await prisma().taskItem.create({
      data: { listId, description: "Decide where Pathways should live" },
    });
    const client = await connect();

    const created = await call(client, "pathways_create", {
      fromTaskId: task.id,
      goals: "Fast to try",
    });
    expect(created.error).toBe(false);
    const id = created.json!.id as string;
    pathwayIds.push(id);
    expect(created.json!.title).toBe("Decide where Pathways should live");
    expect(created.json!.sourceTaskId).toBe(task.id);

    const edit = await call(client, "pathways_edit", {
      id,
      ops: {
        nodes: [
          { ref: "a", kind: "option", title: "Tasks page" },
          { ref: "b", kind: "option", title: "Research board" },
          { ref: "out", kind: "outcome", title: "A small graph store" },
        ],
        edges: [
          { from: "root", to: "a" },
          { from: "root", to: "b" },
          { from: "a", to: "out" },
          { from: "b", to: "out" },
          { from: "nope", to: "out" },
        ],
      },
      addQuestions: ["What would make this a good choice a month from now?"],
    });
    expect(edit.error).toBe(false);
    expect(edit.json!.added.map((x: Json) => x.title)).toEqual([
      "Tasks page",
      "Research board",
      "A small graph store",
    ]);
    expect(edit.json!.skipped).toEqual(["nope"]);
    expect(edit.json!.pathsMeet).toHaveLength(1);

    const got = await call(client, "pathways_get", { id });
    const outId = got.json!.cards.find(
      (c: Json) => c.title === "A small graph store",
    ).id;
    expect(got.json!.pathsMeet[0]).toMatchObject({ id: outId, paths: 2 });
    expect(got.json!.goals.qa).toHaveLength(1);

    const plan = await call(client, "pathways_set_plan", {
      id,
      summary: "Settle the store first",
      tasks: [
        {
          title: "Sketch the graph store",
          why: "Both paths need it",
          doneWhen: "Schema written",
          minutes: 30,
          nodeIds: [outId, "gone"],
        },
      ],
    });
    expect(plan.json!.nextSteps.tasks[0]).toMatchObject({
      status: "todo",
      nodeIds: [outId],
    });

    const undo = await call(client, "pathways_undo", { id });
    expect(undo.json!.undid).toBe("mcp: pathways_set_plan");
    expect(
      (await call(client, "pathways_get", { id })).json!.nextSteps,
    ).toBeNull();

    const missing = await call(client, "pathways_get", { id: "missing" });
    expect(missing.error).toBe(true);
  });
});
