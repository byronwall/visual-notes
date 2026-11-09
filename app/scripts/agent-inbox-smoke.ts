// Plays an agent against the agent inbox through the official MCP client.
//
//   MCP_URL=http://127.0.0.1:3285/mcp MCP_BEARER=<MCP_DEV_TOKEN> \
//   node --experimental-strip-types scripts/agent-inbox-smoke.ts --note <id>
//
// It proposes a rewrite of the note's first paragraph and an addition after
// it, then checks that an unknown block id is refused. Run it only against a
// local or disposable database.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const LOG = "[agent-inbox-smoke]";
const url = process.env.MCP_URL;
const bearer = process.env.MCP_BEARER;
const arg = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const noteId = arg("note");

if (!url || !bearer || !noteId) {
  console.error(`${LOG} MCP_URL, MCP_BEARER, and --note <id> are required`);
  process.exit(2);
}

type ToolResult = {
  isError?: boolean;
  content: { type: string; text?: string }[];
  structuredContent?: any;
};

async function connect(name: string) {
  const client = new Client({ name, version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(url!), {
      requestInit: { headers: { Authorization: `Bearer ${bearer}` } },
    }),
  );
  return async (tool: string, args: Record<string, unknown>) => {
    const result = (await client.callTool({ name: tool, arguments: args })) as ToolResult;
    console.info(`${LOG} ${result.isError ? "ERR" : "ok "} ${name} ${tool}`, result.isError ? result.content[0]?.text : "");
    return result;
  };
}

function check(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`${LOG} FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.info(`${LOG} PASS ${message}`);
  }
}

const agent = await connect("Smoke Agent");

const note = await agent("notes_get", { ids: [noteId] });
const markdown: string = note.structuredContent?.notes?.[0]?.markdown ?? "";
const ids = [...markdown.matchAll(/\^(\w+)\s*$/gm)].map((m) => m[1]);
check(ids.length >= 2, `note has block ids (${ids.length})`);

const unknown = await agent("notes_propose_edits", {
  id: noteId,
  edits: [{ op: "delete", blockId: "not-a-block" }],
});
check(unknown.isError && /Unknown block id/.test(unknown.content[0]?.text ?? ""), "unknown block id is refused");

const proposed = await agent("notes_propose_edits", {
  id: noteId,
  summary: "Expand the opening with newer numbers",
  edits: [
    {
      op: "replace",
      blockId: ids[1],
      markdown: "Cold-climate heat pumps keep about **80% of rated capacity at 5°F**, per the 2025 NEEP list.",
    },
    {
      op: "insert_after",
      blockId: ids[1],
      markdown: "- Check the unit's NEEP listing\n- Size for the 99% design temperature",
    },
  ],
});
check(!proposed.isError && proposed.structuredContent?.pending === 2, "proposal stored with 2 pending edits");
console.info(`${LOG} open ${proposed.structuredContent?.appUrl}`);
