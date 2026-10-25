import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  testDatabaseEnabled as enabled,
  testDatabaseUrl as url,
} from "~/test/database";

const { client } = vi.hoisted(() => ({
  client: { current: null as PrismaClient | null },
}));
vi.mock("~/server/db", () => ({
  get prisma() {
    return client.current;
  },
}));

const { ingestTree, undoBatch, redoBatch, ResearchIngestError } = await import(
  "./research.ingest"
);
const { setupTopic } = await import("./research.setup");
const { editCards } = await import("./research.edits");
const { addComment, resolveComments } = await import("./research.comments");
const { createTopic, loadTopicGraph } = await import("./research.store");

describe.skipIf(!enabled)("research topic setup (database)", () => {
  client.current = enabled
    ? new PrismaClient({ datasources: { db: { url } } })
    : null;
  const prisma = () => client.current!;
  const topicIds: string[] = [];

  const freshTopic = async () => {
    const topic = await createTopic({ title: `Setup test ${Date.now()}` });
    topicIds.push(topic.id);
    return topic;
  };

  afterAll(async () => {
    if (!client.current) return;
    await prisma().researchTopic.deleteMany({
      where: { id: { in: topicIds } },
    });
    await prisma().$disconnect();
  });

  it("declares streams and kinds, files cards by stream key, and undoes the frame", async () => {
    const topic = await freshTopic();
    const setup = await setupTopic(topic.id, {
      batchKey: "frame-1",
      agent: "test",
      streams: [
        { key: "pick", title: "Pick a carrier", goal: "Cheapest match" },
        { key: "home", title: "Home policy" },
      ],
      kinds: [
        {
          key: "carrier",
          label: "Carrier",
          role: "option",
          fields: [{ key: "price", label: "Price" }],
        },
      ],
      answer: "Nothing chosen yet.",
    });
    expect(setup.replayed).toBe(false);

    const added = await ingestTree(topic.id, {
      batchKey: "cards-1",
      agent: "test",
      cards: [
        {
          type: "question",
          title: "Which carrier?",
          stream: "pick",
          children: [
            { kind: "carrier", title: "Carrier A", fields: { price: 332 } },
          ],
        },
        {
          type: "finding",
          title: "Loose finding with a long body",
          body: "x".repeat(400),
        },
      ],
    });
    expect(
      added.warnings?.some((warning) => warning.includes("in no stream")),
    ).toBe(true);
    expect(
      added.warnings?.some((warning) => warning.includes('no "gist"')),
    ).toBe(true);

    const graph = (await loadTopicGraph(topic.id))!;
    expect(graph.topic.answer).toBe("Nothing chosen yet.");
    expect(graph.topic.kinds.map((kind) => kind.key)).toEqual(["carrier"]);
    expect(graph.streams.map((stream) => stream.key)).toEqual(["pick", "home"]);
    const option = graph.cards.find((card) => card.title === "Carrier A")!;
    expect(option).toMatchObject({
      type: "option",
      kind: "carrier",
      fields: { price: "332" },
    });

    // The frame batch can't be undone while cards depend on its streams.
    const blocked = await undoBatch(setup.batchId);
    expect(blocked.ok).toBe(false);
    expect(await undoBatch(added.batchId)).toEqual({ ok: true });
    expect(await undoBatch(setup.batchId)).toEqual({ ok: true });
    const undone = (await loadTopicGraph(topic.id))!;
    expect(undone.streams).toEqual([]);
    expect(undone.topic.answer).toBe("");
    expect(undone.topic.kinds).toEqual([]);
    expect(await redoBatch(setup.batchId)).toEqual({ ok: true });
    expect((await loadTopicGraph(topic.id))!.streams).toHaveLength(2);
  });

  it("edits stream answers as undoable batches and refuses dropping a kind in use", async () => {
    const topic = await freshTopic();
    await setupTopic(topic.id, {
      batchKey: "frame",
      agent: "test",
      streams: [{ key: "a", title: "A" }],
      kinds: [{ key: "model", label: "Printer model", role: "option" }],
    });
    await ingestTree(topic.id, {
      batchKey: "c",
      agent: "test",
      cards: [{ kind: "model", title: "A1", stream: "a" }],
    });
    await expect(
      setupTopic(topic.id, { batchKey: "drop", agent: "test", kinds: [] }),
    ).rejects.toBeInstanceOf(ResearchIngestError);
    const answer = await setupTopic(topic.id, {
      batchKey: "ans",
      agent: "test",
      streams: [{ key: "a", answer: "Buy the A1." }],
    });
    expect((await loadTopicGraph(topic.id))!.streams[0].answer).toBe(
      "Buy the A1.",
    );
    expect(await undoBatch(answer.batchId)).toEqual({ ok: true });
    expect((await loadTopicGraph(topic.id))!.streams[0].answer).toBe("");
  });

  it("moves cards, sets gist and stream through edits, and round-trips undo", async () => {
    const topic = await freshTopic();
    await setupTopic(topic.id, {
      batchKey: "frame",
      agent: "test",
      streams: [{ key: "a", title: "A" }],
    });
    const added = await ingestTree(topic.id, {
      batchKey: "c",
      agent: "test",
      cards: [
        { type: "finding", title: "F", ref: "f" },
        { type: "source", title: "S", ref: "s" },
      ],
    });
    const [f, s] = [added.refs.f, added.refs.s];
    const edit = await editCards(topic.id, {
      batchKey: "e",
      agent: "test",
      edits: [
        { id: f, gist: "Short.", stream: "a" },
        { id: s, parentId: f },
      ],
    });
    let graph = (await loadTopicGraph(topic.id))!;
    expect(graph.cards.find((card) => card.id === s)?.parentId).toBe(f);
    expect(graph.cards.find((card) => card.id === f)).toMatchObject({
      gist: "Short.",
      streamId: graph.streams[0].id,
    });
    await expect(
      editCards(topic.id, {
        batchKey: "loop",
        agent: "test",
        edits: [{ id: f, parentId: s }],
      }),
    ).rejects.toBeInstanceOf(ResearchIngestError);
    expect(await undoBatch(edit.batchId)).toEqual({ ok: true });
    graph = (await loadTopicGraph(topic.id))!;
    expect(graph.cards.find((card) => card.id === s)?.parentId).toBeNull();
    expect(graph.cards.find((card) => card.id === f)).toMatchObject({
      gist: "",
      streamId: null,
    });
  });

  it("keeps comments outside batches and records how the agent resolved them", async () => {
    const topic = await freshTopic();
    const added = await ingestTree(topic.id, {
      batchKey: "c",
      agent: "test",
      cards: [{ type: "finding", title: "F" }],
    });
    const comment = await addComment(topic.id, {
      cardId: added.refs.$0,
      body: "Price looks stale",
    });
    await resolveComments(topic.id, {
      resolutions: [{ id: comment.id, note: "Re-checked: $340" }],
    });
    const graph = (await loadTopicGraph(topic.id))!;
    expect(graph.comments).toMatchObject([
      {
        body: "Price looks stale",
        author: "you",
        resolution: "Re-checked: $340",
      },
    ]);
    expect(graph.comments[0].resolvedAt).not.toBeNull();
  });
});
