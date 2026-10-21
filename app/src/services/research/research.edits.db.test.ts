import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { testDatabaseEnabled as enabled, testDatabaseUrl as url } from "~/test/database";

const { client } = vi.hoisted(() => ({ client: { current: null as PrismaClient | null } }));
vi.mock("~/server/db", () => ({
  get prisma() {
    return client.current;
  },
}));

const { ingestTree, redoBatch, undoBatch, ResearchIngestError } = await import("./research.ingest");
const { editCards, removeCards, updateTopic } = await import("./research.edits");
const { createTopic, listTopics, loadTopicGraph } = await import("./research.store");

describe.skipIf(!enabled)("research edits (database)", () => {
  client.current = enabled ? new PrismaClient({ datasources: { db: { url } } }) : null;
  const prisma = () => client.current!;
  const topicIds: string[] = [];
  const seeded = async () => {
    const topic = await createTopic({ title: `Edits test ${Date.now()}` });
    topicIds.push(topic.id);
    const base = await ingestTree(topic.id, {
      batchKey: "seed",
      agent: "test",
      cards: [
        { type: "question", title: "Root", children: [{ type: "finding", title: "Leaf" }] },
        { type: "source", title: "Docs", url: "https://a.example" },
      ],
    });
    return { topic, refs: base.refs };
  };
  const card = (id: string) => prisma().researchCard.findUniqueOrThrow({ where: { id } });

  afterAll(async () => {
    if (!client.current) return;
    await prisma().researchTopic.deleteMany({ where: { id: { in: topicIds } } });
    await prisma().$disconnect();
  });

  it("edits cards as a batch that undo and redo swap back and forth", async () => {
    const { topic, refs } = await seeded();
    const edit = await editCards(topic.id, {
      batchKey: "e1",
      agent: "test",
      edits: [{ id: refs.$1, title: "Better docs", url: null }],
    });
    expect(await card(refs.$1)).toMatchObject({ title: "Better docs", url: null });
    expect((await editCards(topic.id, { batchKey: "e1", agent: "test", edits: [] })).replayed).toBe(true);

    expect(await undoBatch(edit.batchId)).toEqual({ ok: true });
    expect(await card(refs.$1)).toMatchObject({ title: "Docs", url: "https://a.example" });
    expect(await redoBatch(edit.batchId)).toEqual({ ok: true });
    expect(await card(refs.$1)).toMatchObject({ title: "Better docs" });
  });

  it("refuses to undo an edit that a later edit changed again", async () => {
    const { topic, refs } = await seeded();
    const first = await editCards(topic.id, { batchKey: "e1", agent: "test", edits: [{ id: refs.$0, title: "One" }] });
    await editCards(topic.id, { batchKey: "e2", agent: "test", edits: [{ id: refs.$0, title: "Two" }] });
    expect(await undoBatch(first.batchId)).toMatchObject({ ok: false });
    expect((await card(refs.$0)).title).toBe("Two");
  });

  it("rejects empty titles and unknown cards without writing", async () => {
    const { topic, refs } = await seeded();
    await expect(
      editCards(topic.id, { batchKey: "bad", agent: "test", edits: [{ id: refs.$0, title: "  " }, { id: "nope" }] }),
    ).rejects.toBeInstanceOf(ResearchIngestError);
    expect(await prisma().researchBatch.count({ where: { topicId: topic.id } })).toBe(1);
  });

  it("removes a card only with its children, and undo brings them back", async () => {
    const { topic, refs } = await seeded();
    await expect(removeCards(topic.id, { batchKey: "r0", agent: "test", ids: [refs.$0] })).rejects.toThrow(/child/);
    const removal = await removeCards(topic.id, { batchKey: "r1", agent: "test", ids: [refs.$0, refs["$0.0"]] });
    expect((await loadTopicGraph(topic.id))?.cards.map((c) => c.title)).toEqual(["Docs"]);
    expect(await undoBatch(removal.batchId)).toEqual({ ok: true });
    expect((await loadTopicGraph(topic.id))?.cards).toHaveLength(3);
    expect(await redoBatch(removal.batchId)).toEqual({ ok: true });
    expect((await loadTopicGraph(topic.id))?.cards).toHaveLength(1);
  });

  it("renames and archives topics", async () => {
    const { topic } = await seeded();
    const renamed = await updateTopic(topic.id, { title: "Renamed topic", archived: true });
    expect(renamed).toMatchObject({ title: "Renamed topic", archivedAt: expect.any(String) });
    expect((await listTopics()).some((t) => t.id === topic.id)).toBe(false);
    expect((await listTopics({ includeArchived: true })).some((t) => t.id === topic.id)).toBe(true);
    await updateTopic(topic.id, { archived: false });
    expect((await listTopics()).some((t) => t.id === topic.id)).toBe(true);
  });
});
