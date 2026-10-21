import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { testDatabaseEnabled as enabled, testDatabaseUrl as url } from "~/test/database";

const { client } = vi.hoisted(() => ({ client: { current: null as PrismaClient | null } }));
vi.mock("~/server/db", () => ({
  get prisma() {
    return client.current;
  },
}));

const { ingestTree, ResearchIngestError, redoBatch, setCardStates, undoBatch } = await import(
  "./research.ingest"
);
const { createTopic, loadTopicGraph } = await import("./research.store");

describe.skipIf(!enabled)("research ingest (database)", () => {
  client.current = enabled ? new PrismaClient({ datasources: { db: { url } } }) : null;
  const prisma = () => client.current!;
  const topicIds: string[] = [];

  const freshTopic = async () => {
    const topic = await createTopic({ title: `Ingest test ${Date.now()}` });
    topicIds.push(topic.id);
    return topic;
  };

  afterAll(async () => {
    if (!client.current) return;
    await prisma().researchTopic.deleteMany({ where: { id: { in: topicIds } } });
    await prisma().$disconnect();
  });

  it("applies a tree with summaries atomically and replays by batchKey", async () => {
    const topic = await freshTopic();
    const payload = {
      batchKey: "round-1",
      agent: "test",
      cards: [
        { type: "question", title: "Why Pin?", children: [{ type: "finding", title: "Self-refs" }] },
      ],
      summaries: [{ title: "Pinning", covers: ["$0", "$0.0"] }],
    };
    const first = await ingestTree(topic.id, payload);
    const again = await ingestTree(topic.id, payload);
    expect(first).toMatchObject({ replayed: false, cardCount: 2, summaryCount: 1 });
    expect(again).toMatchObject({ replayed: true, batchId: first.batchId, refs: first.refs });

    const graph = await loadTopicGraph(topic.slug);
    expect(graph?.cards).toHaveLength(3);
    expect(graph?.groups[0]).toMatchObject({ status: "draft" });
    expect(graph?.groups[0].memberIds.sort()).toEqual([first.refs.$0, first.refs["$0.0"]].sort());
  });

  it("writes nothing when any part of the payload is invalid", async () => {
    const topic = await freshTopic();
    await expect(
      ingestTree(topic.id, {
        batchKey: "bad",
        agent: "test",
        cards: [{ type: "finding", title: "ok" }],
        links: [{ from: "$0", to: "ghost" }],
      }),
    ).rejects.toBeInstanceOf(ResearchIngestError);
    expect(await prisma().researchCard.count({ where: { topicId: topic.id } })).toBe(0);
    expect(await prisma().researchBatch.count({ where: { topicId: topic.id } })).toBe(0);
  });

  it("undo hides a batch, refuses while later batches build on it, and redo restores", async () => {
    const topic = await freshTopic();
    const a = await ingestTree(topic.id, {
      batchKey: "a",
      agent: "test",
      cards: [{ type: "question", title: "Root q" }],
    });
    const b = await ingestTree(topic.id, {
      batchKey: "b",
      agent: "test",
      under: a.refs.$0,
      cards: [{ type: "finding", title: "Answer" }],
    });

    const blocked = await undoBatch(a.batchId);
    expect(blocked).toEqual({
      ok: false,
      reason: expect.any(String),
      blockingBatchIds: [b.batchId],
    });

    expect(await undoBatch(b.batchId)).toEqual({ ok: true });
    expect((await loadTopicGraph(topic.slug))?.cards.map((c) => c.title)).toEqual(["Root q"]);
    expect(await undoBatch(a.batchId)).toEqual({ ok: true });
    expect((await loadTopicGraph(topic.slug))?.cards).toHaveLength(0);

    // b hangs from a, so it cannot come back first.
    expect(await redoBatch(b.batchId)).toMatchObject({ ok: false, blockingBatchIds: [a.batchId] });
    expect(await redoBatch(a.batchId)).toEqual({ ok: true });
    expect(await redoBatch(b.batchId)).toEqual({ ok: true });
    expect((await loadTopicGraph(topic.slug))?.cards).toHaveLength(2);
  });

  it("records agent state changes as an undoable batch", async () => {
    const topic = await freshTopic();
    const a = await ingestTree(topic.id, {
      batchKey: "a",
      agent: "test",
      cards: [{ type: "task", title: "Read the book" }],
    });
    const change = await setCardStates(topic.id, {
      batchKey: "close",
      agent: "test",
      changes: [{ id: a.refs.$0, state: "done" }],
    });
    const stateOf = async () =>
      (await prisma().researchCard.findUniqueOrThrow({ where: { id: a.refs.$0 } })).state;
    expect(await stateOf()).toBe("done");
    expect(await undoBatch(change.batchId)).toEqual({ ok: true });
    expect(await stateOf()).toBe("open");
  });
});
