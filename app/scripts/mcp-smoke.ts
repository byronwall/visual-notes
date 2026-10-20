// End-to-end smoke for the ChatGPT MCP connector, driven by the official MCP client.
//
//   MCP_URL=http://127.0.0.1:3161/mcp MCP_BEARER=<token> \
//   node --experimental-strip-types scripts/mcp-smoke.ts --human-note <id>
//
// Creates one note under `mcp-smoke.<timestamp>`, updates and appends to it, and
// checks that updating the given user-authored note is refused. Run it only
// against a local or disposable database.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.env.MCP_URL;
const bearer = process.env.MCP_BEARER;
const humanNoteIndex = process.argv.indexOf("--human-note");
const humanNoteId =
  humanNoteIndex > 0 ? process.argv[humanNoteIndex + 1] : undefined;

if (!url || !bearer) {
  console.error("[mcp-smoke] MCP_URL and MCP_BEARER are required");
  process.exit(2);
}

type ToolResult = {
  isError?: boolean;
  content: { type: string; text?: string }[];
  structuredContent?: any;
};

const client = new Client({ name: "visual-notes-mcp-smoke", version: "1.0.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${bearer}` } },
  }),
);

async function call(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const result = (await client.callTool({
    name,
    arguments: args,
  })) as ToolResult;
  const label = result.isError ? "ERR" : "ok ";
  console.info(
    `[mcp-smoke] ${label} ${name}`,
    result.isError ? result.content[0]?.text : "",
  );
  return result;
}

function check(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`[mcp-smoke] FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.info(`[mcp-smoke] PASS ${message}`);
  }
}

const tools = await client.listTools();
check(
  tools.tools.length === 7,
  `lists 7 tools (${tools.tools.map((t) => t.name).join(", ")})`,
);

const path = `mcp-smoke.run-${Date.now()}`;
const key = `smoke-${Date.now()}`;
const created = await call("create_note", {
  title: "MCP smoke plan",
  path,
  markdown: "# Plan\n\n- first step",
  idempotencyKey: key,
});
const note = created.structuredContent;
check(
  !created.isError && note?.pathIsNew === true,
  "create_note at a new path reports pathIsNew",
);

const retry = await call("create_note", {
  title: "dup",
  path,
  markdown: "dup",
  idempotencyKey: key,
});
check(
  retry.structuredContent?.id === note.id &&
    retry.structuredContent?.deduplicated,
  "retry with same key returns the first note",
);

const updated = await call("update_note", {
  id: note.id,
  markdown: "# Plan\n\n- first step\n- second step",
});
check(
  updated.structuredContent?.version === 2,
  "update_note snapshots the prior version",
);

const appended = await call("append_to_note", {
  id: note.id,
  markdown: "## Log\n\nAppended line",
});
check(
  appended.structuredContent?.version === 3,
  "append_to_note snapshots again",
);

const fetched = await call("get_notes", { ids: [note.id] });
const markdown: string = fetched.structuredContent?.notes?.[0]?.markdown ?? "";
check(
  markdown.includes("second step") && markdown.includes("Appended line"),
  "get_notes returns the latest markdown",
);

const found = await call("search", { query: "MCP smoke plan" });
check(
  found.structuredContent?.results?.some(
    (r: { id: string }) => r.id === note.id,
  ),
  "search finds the new note",
);

const recent = await call("list_recent", { createdBy: "chatgpt", limit: 5 });
check(
  recent.structuredContent?.results?.[0]?.id === note.id,
  "list_recent shows it first",
);

const paths = await call("list_paths", { prefix: "mcp-smoke" });
check(
  paths.structuredContent?.results?.some(
    (p: { path: string }) => p.path === path,
  ),
  "list_paths includes the new path",
);

if (humanNoteId) {
  const refused = await call("update_note", {
    id: humanNoteId,
    title: "hijacked",
  });
  check(
    refused.isError && refused.content[0]?.text?.startsWith("not_owner"),
    "update of a user note is refused",
  );
}

console.info(`[mcp-smoke] note ${note.url}`);
await client.close();
