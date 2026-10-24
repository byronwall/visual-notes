import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";

// Only the tool declarations matter here; the stores behind them are stubbed.
vi.mock("~/server/db", () => ({ prisma: {} }));
vi.mock("./call-log", () => ({ recordMcpCall: vi.fn() }));
vi.mock("./notes-read", () => ({ MAX_NOTES_PER_GET: 10 }));
vi.mock("./notes-write", () => ({}));
vi.mock("./search-groups", () => ({
  SEARCH_KINDS: ["research", "tasks", "archive"],
}));

const { createToolRegistrar } = await import("./tool-registry");
const { registerNoteFileTools } = await import("./note-files-tools");
const { registerNoteTools } = await import("./notes-tools");

const ctx = {
  origin: "https://notes.test",
  actorId: "chatgpt:test",
  scopes: ["notes:read", "notes:write"],
  scopeChallenge: "",
};

async function listTools() {
  const server = new McpServer({ name: "test", version: "1" });
  const tools = createToolRegistrar(server, ctx);
  registerNoteTools(tools);
  registerNoteFileTools(tools);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: "test-client", version: "1" });
  await client.connect(clientSide);
  const { tools: listed } = await client.listTools();
  await client.close();
  return new Map(listed.map((tool) => [tool.name, tool]));
}

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean;
};

/** The file object shape ChatGPT's tool scan checks. */
function expectChatGptFileObject(schema: JsonSchema | undefined) {
  expect(schema?.type).toBe("object");
  expect(Object.keys(schema?.properties ?? {}).sort()).toEqual([
    "download_url",
    "file_id",
    "file_name",
    "mime_type",
  ]);
  expect(schema?.required?.sort()).toEqual(["download_url", "file_id"]);
  expect(schema?.additionalProperties).toBe(false);
}

describe("file tools as ChatGPT sees them", () => {
  it("declares ChatGPT file params with the required file object shape", async () => {
    const tools = await listTools();

    const attach = tools.get("notes_attach_file");
    expect(attach?._meta).toEqual({ "openai/fileParams": ["files"] });
    expect(attach?.annotations).toMatchObject({
      readOnlyHint: false,
      openWorldHint: true,
    });
    const files = (attach!.inputSchema as JsonSchema).properties?.files;
    expect(files?.type).toBe("array");
    expectChatGptFileObject(files?.items);

    const image = tools.get("notes_upload_image");
    expect(image?._meta).toEqual({ "openai/fileParams": ["file"] });
    expectChatGptFileObject(
      (image!.inputSchema as JsonSchema).properties?.file,
    );

    expect(tools.get("notes_create")?._meta).toBeUndefined();
  });
});
