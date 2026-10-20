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
vi.mock("./notes-write", () => ({ appendToNote: vi.fn(), createNote: vi.fn(), updateNote: vi.fn() }));

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
  };
});
vi.mock("~/services/research/research.ingest", () => service);
vi.mock("~/services/research/research.store", () => service);

const { createNotesMcpServer } = await import("./tools");

const connect = async (scopes = ["notes:read", "notes:write"]) => {
  const server = createNotesMcpServer({
    origin: "https://notes.test",
    actorId: "chatgpt:test",
    scopes,
    scopeChallenge: 'Bearer error="insufficient_scope"',
  });
  const client = new Client({ name: "contract-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
};

const textOf = (result: Awaited<ReturnType<Client["callTool"]>>) =>
  (result.content as { type: string; text: string }[])[0].text;

const topic = { id: "t1", slug: "learn-rust", title: "Learn Rust", archivedAt: null };

afterEach(() => vi.clearAllMocks());

describe("research MCP tools", () => {
  it("are listed next to the notes tools", async () => {
    const client = await connect();
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "search",
        "research_list_topics",
        "research_create_topic",
        "research_read_topic",
        "research_list_frontier",
        "research_get_card",
        "research_ingest_tree",
        "research_add_card",
        "research_link_cards",
        "research_set_state",
      ]),
    );
  });

  it("ingests through the service with the caller as agent and a link back", async () => {
    service.resolveTopic.mockResolvedValue(topic);
    service.ingestTree.mockResolvedValue({ batchId: "b1", batchKey: "k1", replayed: false, refs: {}, cardCount: 1, linkCount: 0, summaryCount: 0 });
    const client = await connect();
    const result = await client.callTool({
      name: "research_ingest_tree",
      arguments: {
        topic: "learn-rust",
        under: "q1",
        batchKey: "k1",
        cards: [{ type: "finding", title: "Pin stops moves", children: [{ type: "source", title: "docs" }] }],
      },
    });
    expect(result.isError).toBeFalsy();
    expect(service.ingestTree).toHaveBeenCalledWith("t1", {
      under: "q1",
      agent: "chatgpt:test",
      batchKey: "k1",
      cards: [{ type: "finding", title: "Pin stops moves", children: [{ type: "source", title: "docs" }] }],
    });
    expect(JSON.parse(textOf(result))).toMatchObject({ cardCount: 1, url: "https://notes.test/research/learn-rust" });
  });

  it("returns validation issues as a fixable refusal", async () => {
    service.resolveTopic.mockResolvedValue(topic);
    service.ingestTree.mockRejectedValue(new service.ResearchIngestError(['links.0.to: unknown ref "ghost"']));
    const client = await connect();
    const result = await client.callTool({
      name: "research_ingest_tree",
      arguments: { topic: "learn-rust", links: [{ from: "a", to: "ghost" }] },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Nothing was written. Fix these and retry:\n- links.0.to: unknown ref "ghost"');
  });

  it("reports an unknown topic as not found", async () => {
    service.resolveTopic.mockResolvedValue(null);
    const client = await connect();
    const result = await client.callTool({ name: "research_add_card", arguments: { topic: "nope", type: "task", title: "x" } });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("not_found");
  });

  it("needs notes:write for writes but not for reads", async () => {
    service.listTopics.mockResolvedValue([]);
    const client = await connect(["notes:read"]);
    const write = await client.callTool({ name: "research_create_topic", arguments: { title: "x" } });
    expect(write.isError).toBe(true);
    expect(write._meta).toMatchObject({ "mcp/www_authenticate": ['Bearer error="insufficient_scope"'] });
    expect(service.createTopic).not.toHaveBeenCalled();
    const read = await client.callTool({ name: "research_list_topics", arguments: {} });
    expect(read.isError).toBeFalsy();
  });

  it("renders the topic summary with ids and the frontier", async () => {
    service.loadTopicGraph.mockResolvedValue({
      topic,
      cards: [
        { id: "q1", type: "question", title: "Why Pin?", body: "", state: "open", parentId: null, sortOrder: 0, createdAt: "", updatedAt: "" },
        { id: "f1", type: "finding", title: "Self refs", body: "", state: null, parentId: "q1", sortOrder: 0, createdAt: "", updatedAt: "" },
        { id: "q2", type: "question", title: "When Unpin?", body: "", state: "open", parentId: "f1", sortOrder: 0, createdAt: "", updatedAt: "" },
      ],
      links: [],
      groups: [],
      batches: [],
      generatedAt: "",
    });
    const client = await connect();
    const result = await client.callTool({ name: "research_read_topic", arguments: { topic: "learn-rust" } });
    const { markdown, url } = JSON.parse(textOf(result));
    expect(url).toBe("https://notes.test/research/learn-rust");
    expect(markdown).toContain("[q2] question (open): When Unpin?  ← Why Pin? › Self refs");
    expect(markdown).toContain("3 cards, 2 open.");
  });
});
