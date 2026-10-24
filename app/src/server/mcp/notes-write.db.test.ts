import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { testDatabaseEnabled as enabled, testDatabaseUrl as url } from "~/test/database";

const { client } = vi.hoisted(() => ({ client: { current: null as PrismaClient | null } }));
vi.mock("~/server/db", () => ({
  get prisma() {
    return client.current;
  },
}));
vi.mock("./semantic", () => ({ scheduleEmbeddingRefresh: vi.fn() }));
vi.mock("~/server/events/action-events", () => ({ logActionEvent: vi.fn() }));
vi.mock("~/features/docs-index/data/docs.queries.search", () => ({ searchDocs: vi.fn() }));

const { createNote, editNote, updateNote } = await import("./notes-write");
const { getNotes } = await import("./notes-read");

const ctx = {
  origin: "https://notes.test",
  actorId: "chatgpt:test",
  scopes: ["notes:read", "notes:write"],
  scopeChallenge: "",
};

describe.skipIf(!enabled)("connector note writes (database)", () => {
  client.current = enabled ? new PrismaClient({ datasources: { db: { url } } }) : null;
  const prisma = () => client.current!;
  const docIds: string[] = [];
  const create = async (markdown: string) => {
    const note = await createNote(ctx, { title: `MCP write ${Date.now()}`, markdown });
    docIds.push(note.id);
    return note;
  };
  const read = async (id: string) => (await getNotes(ctx, { ids: [id] })).notes[0];

  afterAll(async () => {
    if (!client.current) return;
    await prisma().taskItem.deleteMany({ where: { sourceDocId: { in: docIds } } });
    await prisma().doc.deleteMany({ where: { id: { in: docIds } } });
    await prisma().$disconnect();
  });

  it("turns task lines into Inbox tasks linked to their block", async () => {
    const note = await create("Plan\n\n- [ ] Draft the brief\n- [x] Book the room");
    const tasks = await prisma().taskItem.findMany({
      where: { sourceDocId: note.id },
      orderBy: { sortOrder: "asc" },
      include: { list: true },
    });
    expect(tasks.map((t) => [t.description, t.status, t.list.name])).toEqual([
      ["Draft the brief", "waiting", "Inbox"],
      ["Book the room", "complete", "Inbox"],
    ]);
    expect(tasks.every((t) => t.sourceBlockId)).toBe(true);
    expect(note.tasks?.map((t) => [t.id, t.status, t.created])).toEqual(
      tasks.map((t) => [t.id, t.status, true]),
    );
    expect(note.notice).toBeUndefined();
    const markdown = (await read(note.id)).markdown;
    expect(markdown).toMatch(/- \[ \] Draft the brief \^\w+/);
    expect(markdown).toMatch(/- \[x\] Book the room \^\w+/);
  });

  it("keeps the task when a task line is rewritten, and its checkbox sets status", async () => {
    const note = await create("- [ ] Ship it");
    const [task] = await prisma().taskItem.findMany({ where: { sourceDocId: note.id } });
    const blockId = (await read(note.id)).markdown.match(/\^(\w+)/)![1];

    await editNote(ctx, { id: note.id, edits: [{ op: "replace", blockId, markdown: "- [x] Ship it today" }] });
    const after = await prisma().taskItem.findMany({ where: { sourceDocId: note.id } });
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: task.id, status: "complete", description: "Ship it today" });

    // A full rewrite matches the line by text.
    await updateNote(ctx, { id: note.id, markdown: "Intro\n\n- [ ] Ship it today" });
    const reopened = await prisma().taskItem.findUniqueOrThrow({ where: { id: task.id } });
    expect(reopened).toMatchObject({ status: "waiting", sourceDocId: note.id });
    expect(await prisma().taskItem.count({ where: { sourceDocId: note.id } })).toBe(1);
  });

  it("warns when one write files a procedure as many Inbox tasks", async () => {
    const steps = Array.from({ length: 9 }, (_, i) => `- [ ] Step ${i + 1}`).join("\n");
    const note = await create(`Replace the fan motor tonight.\n\n${steps}`);
    expect(note.tasks).toHaveLength(9);
    expect(note.notice).toMatch(/added 9 tasks/);
    const blockId = (await read(note.id)).markdown.match(/Step 1 \^(\w+)/)![1];
    const edited = await editNote(ctx, {
      id: note.id,
      edits: [{ op: "insert_after", blockId, markdown: "1. Turn off the breaker" }],
    });
    expect(edited.tasks?.every((t) => !t.created)).toBe(true);
    expect(edited.notice).toBeUndefined();
  });

  it("writes [[links]] and #tags as real links and tags", async () => {
    const target = await create("Target note");
    const note = await create(`See [[Target|${target.id}]] for #launch prep.`);
    const links = await prisma().docLink.findMany({ where: { sourceDocId: note.id } });
    expect(links.map((l) => l.targetDocId)).toEqual([target.id]);
    const blocks = await prisma().docBlock.findMany({ where: { docId: note.id } });
    expect(blocks.flatMap((b) => b.tags)).toEqual(["launch"]);
    expect((await read(note.id)).markdown).toContain(`|${target.id}]] for #launch`);
  });

  it("refuses links to notes that do not exist", async () => {
    await expect(create("See [[Ghost|nope_not_a_note]]")).rejects.toThrow(/does not exist/);
  });
});
