import { PrismaClient } from "@prisma/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  testDatabaseEnabled as enabled,
  testDatabaseUrl as url,
} from "~/test/database";

// The task tools end to end: SDK client ↔ real server ↔ real task store and
// database, so the rules (Inbox default, note-owned text, subtree moves) are
// checked where they live.

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
const { createNote } = await import("./notes-write");
const { contentColumns, prepareContent } = await import(
  "~/server/notes/note-store"
);

const ctx = {
  origin: "https://notes.test",
  actorId: "chatgpt:test",
  scopes: ["notes:read", "notes:write"],
  scopeChallenge: "",
};

type Json = Record<string, any>;

describe.skipIf(!enabled)("task tools (database)", () => {
  db.current = enabled
    ? new PrismaClient({ datasources: { db: { url } } })
    : null;
  const prisma = () => db.current!;
  const listIds: string[] = [];
  const docIds: string[] = [];
  const suffix = `${Date.now()}`;

  const connect = async () => {
    const server = createNotesMcpServer(ctx);
    const client = new Client({ name: "tasks-test", version: "1.0.0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(b), client.connect(a)]);
    return client;
  };
  const call = async (client: Client, name: string, args: Json) => {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    const parsed = result.isError ? null : JSON.parse(text);
    return { error: Boolean(result.isError), text, json: parsed };
  };

  afterAll(async () => {
    if (!db.current) return;
    await prisma().taskItem.deleteMany({
      where: {
        OR: [{ listId: { in: listIds } }, { sourceDocId: { in: docIds } }],
      },
    });
    await prisma().taskList.deleteMany({ where: { id: { in: listIds } } });
    await prisma().doc.deleteMany({ where: { id: { in: docIds } } });
    await prisma().$disconnect();
  });

  it("creates lists and tasks, queries them, and moves a subtree across lists", async () => {
    const client = await connect();
    const work = await call(client, "tasks_create_list", {
      name: `Work ${suffix}`,
    });
    const later = await call(client, "tasks_create_list", {
      name: `Later ${suffix}`,
    });
    listIds.push(work.json.id, later.json.id);

    const parent = await call(client, "tasks_create", {
      list: `work ${suffix}`,
      description: "Ship the parity stack",
      dueDate: "2026-10-30",
      tags: ["mcp"],
    });
    expect(parent.json).toMatchObject({
      list: `Work ${suffix}`,
      dueDate: "2026-10-30",
      textEditable: true,
    });
    const child = await call(client, "tasks_create", {
      list: work.json.id,
      parentTaskId: parent.json.id,
      description: "Write the docs",
    });

    const due = await call(client, "tasks_query", {
      list: work.json.id,
      dueBefore: "2026-10-31",
    });
    expect(due.json.tasks.map((t: Json) => t.description)).toEqual([
      "Ship the parity stack",
    ]);
    const tagged = await call(client, "tasks_query", {
      tag: "#mcp",
      list: work.json.id,
    });
    expect(tagged.json.tasks).toHaveLength(1);

    const moved = await call(client, "tasks_move", {
      id: parent.json.id,
      list: later.json.id,
    });
    expect(moved.json).toMatchObject({
      listId: later.json.id,
      parentTaskId: null,
    });
    const childRow = await prisma().taskItem.findUniqueOrThrow({
      where: { id: child.json.id },
    });
    expect(childRow).toMatchObject({
      listId: later.json.id,
      parentTaskId: parent.json.id,
    });

    const lists = await call(client, "tasks_list_lists", {});
    expect(
      lists.json.lists.find((l: Json) => l.id === later.json.id),
    ).toMatchObject({ openCount: 2, totalCount: 2 });
  });

  it("updates status on any task but leaves text in the user's notes alone", async () => {
    const client = await connect();
    const userDoc = await prisma().doc.create({
      data: {
        title: `User note ${suffix}`,
        ...contentColumns(prepareContent({ markdown: "" })),
      },
      select: { id: true },
    });
    docIds.push(userDoc.id);
    const list = await prisma().taskList.create({
      data: { name: `Inline ${suffix}` },
      select: { id: true },
    });
    listIds.push(list.id);
    const userTask = await prisma().taskItem.create({
      data: {
        listId: list.id,
        description: "Call the vet",
        sourceDocId: userDoc.id,
      },
      select: { id: true },
    });

    const refused = await call(client, "tasks_update", {
      updates: [{ id: userTask.id, description: "Call the dentist" }],
    });
    expect(refused.error).toBe(true);
    expect(refused.text).toContain("which the user wrote");

    const done = await call(client, "tasks_update", {
      updates: [{ id: userTask.id, status: "complete" }],
    });
    expect(done.json.tasks[0]).toMatchObject({
      status: "complete",
      textEditable: false,
      note: { id: userDoc.id },
    });
  });

  it("finds the tasks a connector note created", async () => {
    const client = await connect();
    const note = await createNote(ctx, {
      title: `Agent note ${suffix}`,
      markdown: "- [ ] Agent line task",
    });
    docIds.push(note.id);
    const found = await call(client, "tasks_query", { noteId: note.id });
    expect(found.json.tasks).toEqual([
      expect.objectContaining({
        description: "Agent line task",
        list: "Inbox",
        textEditable: true,
      }),
    ]);
    const renamed = await call(client, "tasks_update", {
      updates: [
        { id: found.json.tasks[0].id, description: "Agent line task, edited" },
      ],
    });
    expect(renamed.error).toBe(false);
  });
});
