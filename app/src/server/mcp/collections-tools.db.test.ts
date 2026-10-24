import { PrismaClient } from "@prisma/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  testDatabaseEnabled as enabled,
  testDatabaseUrl as url,
} from "~/test/database";

// Collection tools end to end against Postgres: schema by name, values as
// plain text, filters over saved views, membership, and hosted embeds.

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

describe.skipIf(!enabled)("collection tools (database)", () => {
  db.current = enabled
    ? new PrismaClient({ datasources: { db: { url } } })
    : null;
  const prisma = () => db.current!;
  const collectionIds: string[] = [];
  const docIds: string[] = [];
  const name = `Reading ${Date.now()}`;

  const connect = async () => {
    const server = createNotesMcpServer(ctx);
    const client = new Client({ name: "collections-test", version: "1.0.0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(b), client.connect(a)]);
    return client;
  };
  const call = async (client: Client, tool: string, args: Json) => {
    const result = await client.callTool({ name: tool, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    const parsed = result.isError ? null : JSON.parse(text);
    return { error: Boolean(result.isError), text, json: parsed };
  };

  afterAll(async () => {
    if (!db.current) return;
    await prisma().doc.deleteMany({
      where: {
        OR: [{ id: { in: docIds } }, { collectionId: { in: collectionIds } }],
      },
    });
    await prisma().collection.deleteMany({
      where: { id: { in: collectionIds } },
    });
    await prisma().$disconnect();
  });

  it("builds a collection, adds rows with plain-text values, and queries them", async () => {
    const client = await connect();
    const created = await call(client, "collections_create", {
      name,
      properties: [
        { name: "Rating", kind: "number" },
        { name: "Finished", kind: "date" },
        { name: "Genre", kind: "select", options: ["Fiction", "History"] },
      ],
    });
    collectionIds.push(created.json.id);

    const schema = await call(client, "collections_get", { collection: name });
    expect(schema.json.properties.map((p: Json) => p.name)).toEqual([
      "Status",
      "Tags",
      "Rating",
      "Finished",
      "Genre",
    ]);

    const dune = await call(client, "collections_add_row", {
      collection: name,
      title: "Dune",
      markdown: "Spice and sand.",
      values: {
        Status: "Done",
        Rating: 5,
        Finished: "2026-09-01",
        Genre: "Fiction",
        Tags: ["classic", "scifi"],
      },
    });
    docIds.push(dune.json.id);
    expect(dune.json.properties).toMatchObject({
      Status: "Done",
      Rating: "5",
      Genre: "Fiction",
      Tags: "classic, scifi",
    });
    const spqr = await call(client, "collections_add_row", {
      collection: name,
      title: "SPQR",
      values: { Status: "In progress", Genre: "History" },
    });
    docIds.push(spqr.json.id);

    const fiction = await call(client, "collections_query", {
      collection: name,
      where: [{ property: "Genre", op: "is", value: "Fiction" }],
    });
    expect(fiction.json.rows.map((r: Json) => r.title)).toEqual(["Dune"]);
    const sorted = await call(client, "collections_query", {
      collection: name,
      sort: [{ property: "Title", direction: "desc" }],
    });
    expect(sorted.text).not.toContain("Error");
    expect(sorted.json.rows.map((r: Json) => r.title)).toEqual([
      "SPQR",
      "Dune",
    ]);

    const bad = await call(client, "collections_set_values", {
      collection: name,
      rows: [{ id: spqr.json.id, values: { Rating: "lots" } }],
    });
    expect(bad.error).toBe(true);
    const set = await call(client, "collections_set_values", {
      collection: name,
      rows: [{ id: spqr.json.id, values: { Rating: 4, Genre: "Classics" } }],
    });
    expect(set.json.rows[0].properties).toMatchObject({
      Rating: "4",
      Genre: "Classics",
    });
  });

  it("adds rows in one call, reports a refused row, and flags copied bodies", async () => {
    const client = await connect();
    const name = `MCP batch ${Date.now()}`;
    const created = await call(client, "collections_create", { name });
    collectionIds.push(created.json.id);
    const shared =
      "**Auto-Owners:** Central Insurance Associates sent a draft quote; Liberty Mutual is pending.";

    const bad = await call(client, "collections_add_rows", {
      collection: name,
      rows: [
        { title: "A", values: { Status: "Done" } },
        { title: "B", values: { Nope: "x" } },
      ],
    });
    expect(bad.error).toBe(true);
    expect(await prisma().doc.count({ where: { collectionId: created.json.id } })).toBe(0);

    const result = await call(client, "collections_add_rows", {
      collection: name,
      rows: [
        { title: "Auto-Owners", markdown: shared, values: { Status: "In progress" } },
        { title: "State Farm", markdown: `${shared}\n\nState Farm route not done.` },
        { title: "Ghost", markdown: "See [[Missing|no_such_note]]" },
      ],
    });
    docIds.push(...result.json.rows.map((r: Json) => r.id));
    expect(result.json.rows.map((r: Json) => [r.index, r.title])).toEqual([
      [0, "Auto-Owners"],
      [1, "State Farm"],
    ]);
    expect(result.json.failed).toMatchObject([
      { index: 2, title: "Ghost", error: expect.stringMatching(/does not exist/) },
    ]);
    expect(result.json.notice).toMatch(/2 rows open with the same text/);
  });

  it("moves notes in and out, and embeds a view in a note it owns", async () => {
    const client = await connect();
    const userNote = await prisma().doc.create({
      data: {
        title: "Loose note",
        ...contentColumns(prepareContent({ markdown: "" })),
      },
      select: { id: true },
    });
    docIds.push(userNote.id);
    const added = await call(client, "collections_add_notes", {
      collection: name,
      noteIds: [userNote.id],
    });
    expect(added.json.rows.map((r: Json) => r.title)).toEqual(["Loose note"]);
    const removed = await call(client, "collections_remove_notes", {
      collection: name,
      noteIds: [userNote.id],
    });
    expect(removed.json).toMatchObject({ removed: 1 });

    const refused = await call(client, "collections_create_view", {
      collection: name,
      name: "Mine",
      hostNoteId: userNote.id,
    });
    expect(refused.error).toBe(true);

    const host = await call(client, "notes_create", {
      title: "Reading log",
      markdown: "Books so far:",
    });
    docIds.push(host.json.id);
    const view = await call(client, "collections_create_view", {
      collection: name,
      name: "Done books",
      type: "board",
      groupBy: "Status",
      where: [{ property: "Status", op: "is", value: "Done" }],
      hostNoteId: host.json.id,
    });
    expect(view.json.embed).toBe(`{{collection-view:${view.json.id}}}`);
    await call(client, "notes_append", {
      id: host.json.id,
      markdown: view.json.embed,
    });
    const note = await call(client, "notes_get", { ids: [host.json.id] });
    expect(note.json.notes[0].embeds).toEqual([
      expect.objectContaining({
        viewId: view.json.id,
        view: "Done books",
        collection: name,
      }),
    ]);

    const viaView = await call(client, "collections_query", {
      collection: name,
      view: "Done books",
    });
    expect(viaView.json.rows.map((r: Json) => r.title)).toEqual(["Dune"]);
  });
});
