import { PrismaClient } from "@prisma/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  testDatabaseEnabled as enabled,
  testDatabaseUrl as url,
} from "~/test/database";

// Layer 5 tools end to end against the real stores: note context (backlinks,
// tags, versions, meta), the time-blocks calendar, the web archive,
// cross-kind search, and recent activity.

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
  searchDocs: vi.fn(async () => []),
}));
vi.mock("./semantic", () => ({
  scheduleEmbeddingRefresh: vi.fn(),
  semanticSearch: vi.fn(),
}));
vi.mock("~/server/note-events", () => ({
  publishAppChange: vi.fn(),
  publishNoteChanges: vi.fn(),
}));

const { createNotesMcpServer } = await import("./tools");
const { createNote, updateNote } = await import("./notes-write");
const { contentColumns, prepareContent } = await import(
  "~/server/notes/note-store"
);
const { publishAppChange } = await import("~/server/note-events");
const { logActionEvent } = await import("~/server/events/action-events");
const { normalizeArchivedPageUrl } = await import("~/server/lib/archive/url");

const ctx = {
  origin: "https://notes.test",
  actorId: "chatgpt:test",
  scopes: ["notes:read", "notes:write"],
  scopeChallenge: "",
};

type Json = Record<string, any>;

describe.skipIf(!enabled)("context tools (database)", () => {
  db.current = enabled
    ? new PrismaClient({ datasources: { db: { url } } })
    : null;
  const prisma = () => db.current!;
  const docIds: string[] = [];
  const blockIds: string[] = [];
  const metaIds: string[] = [];
  const pageIds: string[] = [];
  const topicIds: string[] = [];
  const eventIds: string[] = [];
  const suffix = `${Date.now()}`;

  const connect = async () => {
    const server = createNotesMcpServer(ctx);
    const client = new Client({ name: "context-test", version: "1.0.0" });
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
  const userNote = async (title: string) => {
    const doc = await prisma().doc.create({
      data: { title, ...contentColumns(prepareContent({ markdown: "" })) },
      select: { id: true },
    });
    docIds.push(doc.id);
    return doc.id;
  };

  afterAll(async () => {
    if (!db.current) return;
    await prisma().timeBlock.deleteMany({ where: { id: { in: blockIds } } });
    await prisma().timeBlockDayMetadata.deleteMany({
      where: { id: { in: metaIds } },
    });
    await prisma().archivedPage.deleteMany({ where: { id: { in: pageIds } } });
    await prisma().researchTopic.deleteMany({
      where: { id: { in: topicIds } },
    });
    await prisma().actionEvent.deleteMany({ where: { id: { in: eventIds } } });
    await prisma().taskItem.deleteMany({
      where: { sourceDocId: { in: docIds } },
    });
    await prisma().doc.deleteMany({ where: { id: { in: docIds } } });
    await prisma().$disconnect();
  });

  it("shows backlinks, tags, and open task lines in notes", async () => {
    const client = await connect();
    const target = await createNote(ctx, {
      title: `Target ${suffix}`,
      markdown: "The target.",
    });
    docIds.push(target.id);
    const source = await createNote(ctx, {
      title: `Source ${suffix}`,
      markdown: `See [[Target|${target.id}]] #ctx${suffix}\n\n- [ ] Follow up ${suffix}`,
    });
    docIds.push(source.id);

    const backlinks = await call(client, "notes_get_backlinks", {
      id: target.id,
    });
    expect(backlinks.json.backlinks).toEqual([
      expect.objectContaining({
        noteId: source.id,
        appUrl: `https://notes.test/docs/${source.id}`,
      }),
    ]);
    expect(backlinks.json.backlinks[0].blocks[0].text).toContain("See Target");

    const tagged = await call(client, "notes_list_tags", {
      tag: `#ctx${suffix}`,
    });
    expect(tagged.json.notes.map((g: Json) => g.noteId)).toEqual([source.id]);
    expect(tagged.json.notes[0].blocks[0]).not.toHaveProperty("docId");
    const tags = await call(client, "notes_list_tags", {});
    expect(tags.json.tags).toContainEqual({
      tag: `ctx${suffix}`,
      blocks: 1,
      notes: 1,
    });

    const tasks = await call(client, "tasks_query", { inNotes: true });
    expect(
      tasks.json.tasks.filter((t: Json) => t.note?.id === source.id),
    ).toEqual([
      expect.objectContaining({
        description: `Follow up ${suffix}`,
        status: "waiting",
      }),
    ]);
  });

  it("restores versions of agent notes only and sets meta on any note", async () => {
    const client = await connect();
    const note = await createNote(ctx, {
      title: `Versioned ${suffix}`,
      markdown: "First draft.",
    });
    docIds.push(note.id);
    await updateNote(ctx, {
      id: note.id,
      title: `Versioned v2 ${suffix}`,
      markdown: "Second draft.",
    });

    const versions = await call(client, "notes_list_revisions", {
      id: note.id,
    });
    expect(versions.json).toMatchObject({
      editable: true,
      revisions: [{ reason: "chatgpt.update", title: `Versioned ${suffix}` }],
    });
    const restored = await call(client, "notes_restore_revision", {
      id: note.id,
      revisionId: versions.json.revisions[0].id,
    });
    expect(restored.json).toMatchObject({ title: `Versioned ${suffix}` });
    const [got] = (await call(client, "notes_get", { ids: [note.id] })).json
      .notes;
    expect(got.markdown).toContain("First draft.");
    expect(
      (await call(client, "notes_list_revisions", { id: note.id })).json
        .revisions[0].reason,
    ).toBe("restore");

    const mine = await userNote(`Mine ${suffix}`);
    await prisma().docRevision.create({
      data: {
        docId: mine,
        title: "old",
        markdown: "",
        html: "",
        actorType: "magic_user",
        reason: "restore",
      },
    });
    const userRevision = (
      await call(client, "notes_list_revisions", { id: mine })
    ).json.revisions[0];
    const refused = await call(client, "notes_restore_revision", {
      id: mine,
      revisionId: userRevision.id,
    });
    expect(refused).toMatchObject({ error: true });
    expect(refused.text).toContain("not_owner");
    const crossed = await call(client, "notes_restore_revision", {
      id: note.id,
      revisionId: userRevision.id,
    });
    expect(crossed.text).toContain("not_found");

    const meta = await call(client, "notes_set_meta", {
      ids: [mine],
      set: { status: "draft", score: 3 },
    });
    expect(meta.json.notes).toEqual([
      {
        id: mine,
        title: `Mine ${suffix}`,
        meta: { status: "draft", score: 3 },
        appUrl: `https://notes.test/docs/${mine}`,
      },
    ]);
    await call(client, "notes_set_meta", { ids: [mine], remove: ["score"] });
    const [read] = (await call(client, "notes_get", { ids: [mine] })).json
      .notes;
    expect(read.meta).toEqual({ status: "draft" });
    const key = `stage${suffix}`;
    await call(client, "notes_set_meta", { ids: [mine], set: { [key]: 2 } });
    const keys = await call(client, "notes_list_meta_keys", {});
    expect(keys.json.keys).toContainEqual({ key, count: 1 });
    const values = await call(client, "notes_list_meta_keys", { key });
    expect(values.json).toEqual({ key, values: [{ value: "2", count: 1 }] });
    expect(
      (await call(client, "notes_set_meta", { ids: ["nope"], set: { a: 1 } }))
        .text,
    ).toContain("not_found");
  });

  it("plans time blocks and day values and tells open calendars", async () => {
    const client = await connect();
    const note = await userNote(`Plan ${suffix}`);
    vi.mocked(publishAppChange).mockClear();
    const created = await call(client, "time_blocks_create", {
      title: "Deep work",
      start: "2031-03-04T09:00:00Z",
      end: "2031-03-04T11:00:00Z",
      noteId: note,
    });
    expect(created.json).toMatchObject({
      title: "Deep work",
      start: "2031-03-04T09:00:00.000Z",
      note: { id: note },
    });
    blockIds.push(created.json.id);
    expect(publishAppChange).toHaveBeenCalledWith("time-blocks", [
      created.json.id,
    ]);

    const moved = await call(client, "time_blocks_update", {
      updates: [
        {
          id: created.json.id,
          start: "2031-03-04T13:00:00Z",
          end: "2031-03-04T14:30:00Z",
          noteId: null,
        },
      ],
    });
    expect(moved.json.blocks[0]).toMatchObject({
      start: "2031-03-04T13:00:00.000Z",
      end: "2031-03-04T14:30:00.000Z",
      note: null,
    });
    const backwards = await call(client, "time_blocks_update", {
      updates: [{ id: created.json.id, end: "2031-03-04T12:00:00Z" }],
    });
    expect(backwards.text).toContain("would end before it starts");
    const badNote = await call(client, "time_blocks_create", {
      title: "x",
      start: "2031-03-04T09:00:00Z",
      end: "2031-03-04T10:00:00Z",
      noteId: "missing-note",
    });
    expect(badNote.text).toContain("not_found");

    const day = await call(client, "time_blocks_set_day_value", {
      day: "2031-03-04",
      key: "sleep",
      value: "7h",
    });
    metaIds.push(day.json.id);
    expect(day.json).toMatchObject({
      day: "2031-03-04",
      key: "sleep",
      value: "7h",
      contributor: "default",
    });
    const again = await call(client, "time_blocks_set_day_value", {
      day: "2031-03-04",
      key: "sleep",
      value: "8h",
    });
    expect(again.json).toMatchObject({ id: day.json.id, value: "8h" });

    const listed = await call(client, "time_blocks_query", {
      from: "2031-03-03",
      to: "2031-03-05",
    });
    expect(listed.json.timeZone).toBeTruthy();
    expect(listed.json.blocks.map((b: Json) => b.id)).toContain(
      created.json.id,
    );
    expect(listed.json.dayValues).toEqual([
      expect.objectContaining({ id: day.json.id, value: "8h" }),
    ]);
    expect(
      vi.mocked(logActionEvent).mock.calls.map(([e]) => e.eventType),
    ).toEqual(
      expect.arrayContaining([
        "time_block.created",
        "time_block.updated",
        "time_block_day.set",
      ]),
    );
  });

  it("reads the web archive and adds a note to a page", async () => {
    const client = await connect();
    const pageUrl = `https://example.com/parity/${suffix}?utm_source=x`;
    const page = await prisma().archivedPage.create({
      data: {
        title: `Parity article ${suffix}`,
        originalUrl: pageUrl,
        normalizedUrl: normalizeArchivedPageUrl(pageUrl).normalizedUrl,
        siteHostname: "example.com",
        groupName: "reading",
        lastCapturedAt: new Date(),
        notes: { create: [{ noteText: `Key quote ${suffix}` }] },
      },
      select: { id: true },
    });
    pageIds.push(page.id);

    const found = await call(client, "archive_query", {
      query: `quote ${suffix}`,
    });
    expect(found.json.pages).toEqual([
      expect.objectContaining({
        id: page.id,
        notesCount: 1,
        appUrl: `https://notes.test/archive?item=${page.id}`,
      }),
    ]);
    const byUrl = await call(client, "archive_get", { url: pageUrl });
    expect(byUrl.json).toMatchObject({
      archived: true,
      id: page.id,
      notes: [{ text: `Key quote ${suffix}` }],
    });
    const missing = await call(client, "archive_get", {
      url: `https://example.com/never/${suffix}`,
    });
    expect(missing.json).toMatchObject({ archived: false });

    vi.mocked(publishAppChange).mockClear();
    const added = await call(client, "archive_add_note", {
      pageId: page.id,
      text: "Agent summary",
    });
    expect(added.json).toMatchObject({
      pageId: page.id,
      text: "Agent summary",
    });
    expect(publishAppChange).toHaveBeenCalledWith("archive", [page.id]);
    expect(
      (await call(client, "archive_get", { id: page.id })).json.notesCount,
    ).toBe(2);
  });

  it("searches research, tasks, and the archive in labeled groups", async () => {
    const client = await connect();
    const word = `zebrafish${suffix}`;
    const topic = await prisma().researchTopic.create({
      data: {
        slug: `topic-${suffix}`,
        title: `Topic ${suffix}`,
        cards: { create: [{ type: "finding", title: `About ${word}` }] },
      },
      select: { id: true },
    });
    topicIds.push(topic.id);
    const note = await createNote(ctx, {
      title: `Task note ${suffix}`,
      markdown: `- [ ] Feed the ${word}`,
    });
    docIds.push(note.id);
    const page = await prisma().archivedPage.create({
      data: {
        title: `${word} care`,
        originalUrl: `https://fish.test/${suffix}`,
        normalizedUrl: `https://fish.test/${suffix}`,
      },
      select: { id: true },
    });
    pageIds.push(page.id);

    const plain = await call(client, "search", { query: word });
    expect(plain.json).toEqual({ notes: [] });
    const grouped = await call(client, "search", {
      query: word,
      include: ["research", "tasks", "archive"],
    });
    expect(grouped.json.notes).toEqual([]);
    expect(grouped.json.research).toEqual([
      expect.objectContaining({
        title: `About ${word}`,
        appUrl: `https://notes.test/research/topic-${suffix}`,
      }),
    ]);
    expect(grouped.json.tasks).toEqual([
      expect.objectContaining({
        description: `Feed the ${word}`,
        note: expect.objectContaining({ id: note.id }),
      }),
    ]);
    expect(grouped.json.archive.map((p: Json) => p.id)).toEqual([page.id]);
  });

  it("summarizes recent activity by domain", async () => {
    const client = await connect();
    const event = await prisma().actionEvent.create({
      data: {
        eventType: "time_block.created",
        entityType: "time_block",
        actorType: "chatgpt",
        actorId: "chatgpt:test",
        payload: { title: `Gym ${suffix}`, day: "2031-03-04" },
      },
      select: { id: true },
    });
    eventIds.push(event.id);
    const recent = await call(client, "activity_query", {
      domain: "time_block",
      limit: 50,
    });
    expect(recent.json.events).toContainEqual(
      expect.objectContaining({
        type: "time_block.created",
        summary: `Planned “Gym ${suffix}” 2031-03-04`,
        via: "ChatGPT",
      }),
    );
    expect(
      recent.json.events.every((e: Json) => e.type.startsWith("time_block")),
    ).toBe(true);
    const note = await userNote(`Watched ${suffix}`);
    const noteEvent = await prisma().actionEvent.create({
      data: {
        eventType: "doc.update",
        entityType: "doc",
        entityId: note,
        relatedDocId: note,
        actorType: "chatgpt",
        actorId: "chatgpt:test",
      },
      select: { id: true },
    });
    eventIds.push(noteEvent.id);
    const history = await call(client, "activity_query", { noteId: note });
    expect(history.json.events).toEqual([
      expect.objectContaining({ type: "doc.update", noteId: note }),
    ]);
    expect(
      (await call(client, "activity_query", { since: "not a date" })).text,
    ).toContain("invalid");
  });
});
