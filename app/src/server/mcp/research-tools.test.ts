import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

// Contract test: the real notes MCP server (with research tools registered)
// talks to the SDK client in memory; the research services are faked.

vi.mock("./notes-read", () => ({
  getNotes: vi.fn(),
  listNotePaths: vi.fn(),
  listRecentNotes: vi.fn(),
  searchNotes: vi.fn(),
  MAX_NOTES_PER_GET: 10,
}));
vi.mock("~/server/db", () => ({ prisma: {} }));
vi.mock("~/server/events/action-events", () => ({ logActionEvent: vi.fn() }));
vi.mock("./semantic", () => ({
  scheduleEmbeddingRefresh: vi.fn(),
  semanticSearch: vi.fn(),
}));
vi.mock("./notes-write", () => ({
  appendToNote: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
}));

const service = vi.hoisted(() => {
  class ResearchIngestError extends Error {
    constructor(public readonly issues: string[]) {
      super(issues.join("\n"));
    }
  }
  return {
    ResearchIngestError,
    ingestTree: vi.fn(),
    setCardStates: vi.fn(),
    createTopic: vi.fn(),
    listTopics: vi.fn(),
    loadTopicGraph: vi.fn(),
    resolveTopic: vi.fn(),
    findBatch: vi.fn(),
    undoBatch: vi.fn(),
    redoBatch: vi.fn(),
    editCards: vi.fn(),
    removeCards: vi.fn(),
    updateTopic: vi.fn(),
    setupTopic: vi.fn(),
    resolveComments: vi.fn(),
    logResearchEvent: vi.fn(),
    logUndoRedo: vi.fn(),
    batchPayload: (result: object, extra: object) => ({ ...result, ...extra }),
  };
});
vi.mock("~/services/research/research.ingest", () => service);
vi.mock("~/services/research/research.store", () => service);
vi.mock("~/services/research/research.edits", () => service);
vi.mock("~/services/research/research.activity", () => service);
vi.mock("~/services/research/research.setup", () => service);
vi.mock("~/services/research/research.comments", () => service);

const { createNotesMcpServer } = await import("./tools");

const connect = async (scopes = ["notes:read", "notes:write"]) => {
  const server = createNotesMcpServer({
    origin: "https://notes.test",
    actorId: "chatgpt:test",
    scopes,
    scopeChallenge: 'Bearer error="insufficient_scope"',
  });
  const client = new Client({ name: "contract-test", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
};

const textOf = (result: Awaited<ReturnType<Client["callTool"]>>) =>
  (result.content as { type: string; text: string }[])[0].text;

const topic = {
  id: "t1",
  slug: "learn-rust",
  title: "Learn Rust",
  archivedAt: null,
};

afterEach(() => vi.clearAllMocks());

describe("research MCP tools", () => {
  it("logs a links-only batch as a link", async () => {
    service.resolveTopic.mockResolvedValue(topic);
    service.ingestTree.mockResolvedValue({
      batchId: "b3",
      batchKey: "l1",
      replayed: false,
      refs: {},
      cardCount: 0,
      linkCount: 1,
      summaryCount: 0,
    });
    const client = await connect();
    const result = await client.callTool({
      name: "research_add_cards",
      arguments: { topic: "learn-rust", links: [{ from: "c1", to: "c2" }] },
    });
    expect(result.isError).toBeFalsy();
    expect(service.logResearchEvent).toHaveBeenCalledWith(
      "research.batch_added",
      topic,
      expect.objectContaining({ kind: "link" }),
      expect.any(Object),
    );
  });

  it("are listed next to the notes tools", async () => {
    const client = await connect();
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "search",
        "research_list_topics",
        "research_create_topic",
        "research_get_topic",
        "research_get_card",
        "research_add_cards",
        "research_set_card_states",
        "research_list_batches",
        "research_update_topic",
        "research_update_cards",
        "research_remove_cards",
        "research_undo_batch",
        "research_redo_batch",
      ]),
    );
  });

  it("logs agent batches to the activity timeline", async () => {
    service.resolveTopic.mockResolvedValue(topic);
    service.ingestTree.mockResolvedValue({
      batchId: "b1",
      batchKey: "k1",
      replayed: false,
      refs: {},
      cardCount: 2,
      linkCount: 0,
      summaryCount: 0,
    });
    const client = await connect();
    await client.callTool({
      name: "research_add_cards",
      arguments: {
        topic: "learn-rust",
        cards: [{ type: "task", title: "Read" }],
      },
    });
    expect(service.logResearchEvent).toHaveBeenCalledWith(
      "research.batch_added",
      topic,
      expect.objectContaining({
        batchId: "b1",
        agent: "chatgpt:test",
        kind: "ingest",
      }),
      { actorId: "chatgpt:test", actorType: "chatgpt" },
    );
  });

  it("edits cards through the edit service", async () => {
    service.resolveTopic.mockResolvedValue(topic);
    service.editCards.mockResolvedValue({
      batchId: "b2",
      batchKey: "e1",
      replayed: false,
      refs: {},
      cardCount: 0,
      linkCount: 0,
      summaryCount: 0,
    });
    const client = await connect();
    const result = await client.callTool({
      name: "research_update_cards",
      arguments: {
        topic: "learn-rust",
        batchKey: "e1",
        agent: "claude-code",
        edits: [{ id: "c1", title: "Sharper" }],
      },
    });
    expect(result.isError).toBeFalsy();
    expect(service.editCards).toHaveBeenCalledWith("t1", {
      agent: "claude-code",
      batchKey: "e1",
      edits: [{ id: "c1", title: "Sharper" }],
    });
  });

  it("undoes a batch by its key and reports refusals", async () => {
    service.resolveTopic.mockResolvedValue(topic);
    service.findBatch.mockResolvedValue({ id: "b9" });
    service.undoBatch.mockResolvedValueOnce({ ok: true });
    const client = await connect();
    const ok = await client.callTool({
      name: "research_undo_batch",
      arguments: { topic: "learn-rust", batch: "round-1" },
    });
    expect(ok.isError).toBeFalsy();
    expect(service.undoBatch).toHaveBeenCalledWith("b9");
    expect(service.logUndoRedo).toHaveBeenCalledWith(
      "b9",
      "research.batch_undone",
      expect.any(Object),
    );

    service.undoBatch.mockResolvedValueOnce({
      ok: false,
      reason: "Later batches build on this one.",
      blockingBatchIds: ["b10"],
    });
    const refused = await client.callTool({
      name: "research_undo_batch",
      arguments: { topic: "learn-rust", batch: "b9" },
    });
    expect(refused.isError).toBe(true);
    expect(textOf(refused)).toContain("b10");
  });

  it("ingests through the service with the caller as agent and a link back", async () => {
    service.resolveTopic.mockResolvedValue(topic);
    service.ingestTree.mockResolvedValue({
      batchId: "b1",
      batchKey: "k1",
      replayed: false,
      refs: {},
      cardCount: 1,
      linkCount: 0,
      summaryCount: 0,
    });
    const client = await connect();
    const result = await client.callTool({
      name: "research_add_cards",
      arguments: {
        topic: "learn-rust",
        under: "q1",
        batchKey: "k1",
        cards: [
          {
            type: "finding",
            title: "Pin stops moves",
            children: [{ type: "source", title: "docs" }],
          },
        ],
      },
    });
    expect(result.isError).toBeFalsy();
    expect(service.ingestTree).toHaveBeenCalledWith("t1", {
      under: "q1",
      agent: "chatgpt:test",
      batchKey: "k1",
      cards: [
        {
          type: "finding",
          title: "Pin stops moves",
          children: [{ type: "source", title: "docs" }],
        },
      ],
    });
    expect(JSON.parse(textOf(result))).toMatchObject({
      cardCount: 1,
      appUrl: "https://notes.test/research/learn-rust",
    });
  });

  it("returns validation issues as a fixable refusal", async () => {
    service.resolveTopic.mockResolvedValue(topic);
    service.ingestTree.mockRejectedValue(
      new service.ResearchIngestError(['links.0.to: unknown ref "ghost"']),
    );
    const client = await connect();
    const result = await client.callTool({
      name: "research_add_cards",
      arguments: { topic: "learn-rust", links: [{ from: "a", to: "ghost" }] },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(
      'Nothing was written. Fix these and retry:\n- links.0.to: unknown ref "ghost"',
    );
  });

  it("reports an unknown topic as not found", async () => {
    service.resolveTopic.mockResolvedValue(null);
    const client = await connect();
    const result = await client.callTool({
      name: "research_add_cards",
      arguments: { topic: "nope", cards: [{ type: "task", title: "x" }] },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("not_found");
  });

  it("needs notes:write for writes but not for reads", async () => {
    service.listTopics.mockResolvedValue([]);
    const client = await connect(["notes:read"]);
    const write = await client.callTool({
      name: "research_create_topic",
      arguments: { title: "x" },
    });
    expect(write.isError).toBe(true);
    expect(write._meta).toMatchObject({
      "mcp/www_authenticate": ['Bearer error="insufficient_scope"'],
    });
    expect(service.createTopic).not.toHaveBeenCalled();
    const read = await client.callTool({
      name: "research_list_topics",
      arguments: {},
    });
    expect(read.isError).toBeFalsy();
  });

  const card = (
    id: string,
    type: string,
    extra: Record<string, unknown> = {},
  ) => ({
    id,
    type,
    title: id,
    gist: "",
    body: "",
    kind: null,
    fields: {},
    streamId: null,
    state: type === "question" || type === "task" ? "open" : null,
    url: null,
    snippet: null,
    imageUrl: null,
    parentId: null,
    sortOrder: 0,
    nudgeX: null,
    nudgeY: null,
    batchId: null,
    createdAt: "",
    updatedAt: "",
    ...extra,
  });
  const stream = {
    id: "s1",
    key: "choose",
    title: "Choose",
    goal: "Pick one",
    answer: "Lean A1.",
    sortOrder: 0,
    batchId: null,
    createdAt: "",
    updatedAt: "",
  };
  const graph = () => ({
    topic: {
      ...topic,
      answer: "Buy the A1 Combo.",
      kinds: [
        {
          key: "printer",
          label: "Printer",
          role: "option",
          fields: [{ key: "price", label: "Price" }],
        },
      ],
    },
    streams: [stream],
    comments: [
      {
        id: "c1",
        cardId: "o1",
        streamId: null,
        body: "Price looks stale",
        author: "you",
        resolvedAt: null,
        resolution: null,
        createdAt: "",
      },
    ],
    cards: [
      card("q1", "question", { title: "Why Pin?", streamId: "s1" }),
      card("f1", "finding", {
        title: "Self refs",
        parentId: "q1",
        gist: "They move.",
      }),
      card("q2", "question", { title: "When Unpin?", parentId: "f1" }),
      card("o1", "option", {
        title: "A1",
        kind: "printer",
        streamId: "s1",
        fields: { price: "$259" },
      }),
      card("loose", "finding", { title: "Loose" }),
    ],
    links: [{ id: "l1", fromId: "o1", toId: "q2", kind: "blocks" }],
    groups: [],
    batches: [],
    generatedAt: "",
  });

  it("renders the topic summary by stream with answers, blockers, comments, and lint", async () => {
    service.loadTopicGraph.mockResolvedValue(graph());
    const client = await connect();
    const result = await client.callTool({
      name: "research_get_topic",
      arguments: { topic: "learn-rust" },
    });
    const { markdown, appUrl } = JSON.parse(textOf(result));
    expect(appUrl).toBe("https://notes.test/research/learn-rust");
    expect(markdown).toContain("5 cards, 2 open, 1 open comment for you.");
    expect(markdown).toContain(
      "Link a card for the user as https://notes.test/research/learn-rust?card=<card id>.",
    );
    expect(markdown).toContain("Buy the A1 Combo.");
    expect(markdown).toContain(
      "Kinds: printer = Printer (option; fields price)",
    );
    expect(markdown).toContain(
      "### Choose [stream choose] — 4 cards · goal: Pick one",
    );
    expect(markdown).toContain(
      "[q2] question (open): When Unpin?  ← Why Pin? › Self refs",
    );
    expect(markdown).toContain(
      "[o1] printer (option): A1 · price: $259 · blocked by [q2]",
    );
    expect(markdown).toContain("### Unsorted — 1 card");
    expect(markdown).toContain("[c1] on [o1] “A1”: Price looks stale");
    expect(markdown).toContain("in no stream");
  });

  it("renders a card with its stream, gist, blockers, and comments", async () => {
    service.loadTopicGraph.mockResolvedValue(graph());
    const client = await connect();
    const result = await client.callTool({
      name: "research_get_card",
      arguments: { topic: "learn-rust", id: "o1" },
    });
    const { markdown } = JSON.parse(textOf(result));
    expect(markdown).toContain("Stream: Choose [choose]");
    expect(markdown).toContain("Fields: price: $259");
    expect(markdown).toContain("- blocks: [q2] question (open): When Unpin?");
    expect(markdown).toContain("- [c1] you: Price looks stale (open)");
  });

  it("sets the topic frame as a batch and passes warnings back", async () => {
    service.resolveTopic.mockResolvedValue(topic);
    service.setupTopic.mockResolvedValue({
      batchId: "b5",
      batchKey: "f1",
      replayed: false,
      refs: {},
      cardCount: 0,
      linkCount: 0,
      summaryCount: 0,
      warnings: ["2 cards are in no stream"],
    });
    const client = await connect();
    const result = await client.callTool({
      name: "research_update_topic",
      arguments: {
        topic: "learn-rust",
        batchKey: "f1",
        streams: [{ key: "choose", title: "Choose" }],
        kinds: [{ key: "printer", label: "Printer", role: "option" }],
        answer: "Lean A1.",
      },
    });
    expect(result.isError).toBeFalsy();
    expect(service.setupTopic).toHaveBeenCalledWith("t1", {
      agent: "chatgpt:test",
      batchKey: "f1",
      streams: [{ key: "choose", title: "Choose" }],
      removeStreams: undefined,
      kinds: [{ key: "printer", label: "Printer", role: "option", fields: [] }],
      answer: "Lean A1.",
    });
    expect(service.updateTopic).not.toHaveBeenCalled();
    expect(JSON.parse(textOf(result)).warnings).toEqual([
      "2 cards are in no stream",
    ]);
  });

  it("moves cards with parent and resolves comments", async () => {
    service.resolveTopic.mockResolvedValue(topic);
    service.editCards.mockResolvedValue({
      batchId: "b6",
      batchKey: "e",
      replayed: false,
      refs: {},
      cardCount: 0,
      linkCount: 0,
      summaryCount: 0,
    });
    service.resolveComments.mockResolvedValue({ resolved: 1, reopened: 0 });
    const client = await connect();
    await client.callTool({
      name: "research_update_cards",
      arguments: {
        topic: "learn-rust",
        batchKey: "e",
        edits: [{ id: "s1", parent: "f1", stream: null, gist: "Short." }],
      },
    });
    expect(service.editCards).toHaveBeenCalledWith("t1", {
      agent: "chatgpt:test",
      batchKey: "e",
      edits: [{ id: "s1", parentId: "f1", stream: null, gist: "Short." }],
    });
    const resolved = await client.callTool({
      name: "research_resolve_comments",
      arguments: {
        topic: "learn-rust",
        resolutions: [{ id: "c1", note: "Re-checked" }],
      },
    });
    expect(JSON.parse(textOf(resolved))).toMatchObject({ resolved: 1 });
    expect(service.resolveComments).toHaveBeenCalledWith("t1", {
      resolutions: [{ id: "c1", note: "Re-checked" }],
      resolved: undefined,
    });
  });
});
