// Plays an agent against the agent inbox through the official MCP client.
//
//   MCP_URL=http://127.0.0.1:3285/mcp MCP_BEARER=<MCP_DEV_TOKEN> \
//   node --experimental-strip-types scripts/agent-inbox-smoke.ts --note <id> [--step propose|inbox]
//
// propose: proposes a rewrite of the note's first paragraph and an addition
// after it, and checks that an unknown block id is refused.
// inbox (default): works the note's open requests like a scheduled agent:
// inbox_get, inbox_claim, then an annotation (passage requests) or a
// proposed edit (whole-note requests), then inbox_reply with ready: true.
// Run it only against a local or disposable database.
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
const step = arg("step") ?? "inbox";
const taskId = arg("task");

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

async function proposeStep() {

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
}

async function inboxStep() {
  const inbox = await agent("inbox_get", {});
  const requests = (inbox.structuredContent?.requests ?? []).filter((r: any) => r.noteId === noteId);
  check(requests.length > 0, `inbox lists this note's requests (${requests.length})`);
  check(typeof inbox.structuredContent?.pollSince === "string", "inbox returns pollSince");
  const note = await agent("notes_get", { ids: [noteId] });
  const markdown: string = note.structuredContent?.notes?.[0]?.markdown ?? "";
  const ids = [...markdown.matchAll(/\^(\w+)\s*$/gm)].map((m) => m[1]);

  for (const request of requests) {
    const claim = await agent("inbox_claim", { id: request.id });
    check(!claim.isError && claim.structuredContent?.status === "claimed", `claimed ${request.id}`);
    if (request.on === "passage") {
      const annotated = await agent("notes_annotate", {
        noteId,
        blockId: request.blockId,
        // A passage across blocks: point at its first line.
        quote: String(request.passage).split("\n")[0],
        requestId: request.id,
        comment: "Still true for most 2025 cold-climate models: they keep 70-80% at 5°F, per the NEEP list.",
      });
      check(!annotated.isError, "annotated the passage");
      await agent("inbox_reply", {
        id: request.id,
        message: "Checked the NEEP list. Answered on the passage.",
        ready: true,
      });
    } else {
      const proposed = await agent("notes_propose_edits", {
        id: noteId,
        requestId: request.id,
        summary: "Add newer sources",
        edits: [{ op: "insert_after", blockId: ids.at(-1), markdown: "Sources: NEEP cold-climate list (2025), DOE heat pump guide (2024)." }],
      });
      check(!proposed.isError, "proposed an edit for the request");
      await agent("inbox_reply", {
        id: request.id,
        message: "Proposed a sources line at the end of the note.",
        ready: true,
      });
    }
  }
  // A task request: the agent acts on the task directly, then replies.
  const taskRequests = (inbox.structuredContent?.requests ?? []).filter((r: any) => taskId && r.taskId === taskId);
  for (const request of taskRequests) {
    await agent("inbox_claim", { id: request.id });
    for (const description of ["Get three installer quotes", "Ask each for a Manual J"]) {
      const sub = await agent("tasks_create", { description, parentTaskId: taskId });
      check(!sub.isError, `added subtask "${description}"`);
    }
    await agent("inbox_reply", { id: request.id, message: "Broke it into two subtasks.", ready: true });
  }
  if (taskId) check(taskRequests.length > 0, "inbox lists the task request");

  const after = await agent("inbox_get", { since: inbox.structuredContent?.pollSince });
  const still = (after.structuredContent?.requests ?? []).filter((r: any) => r.noteId === noteId);
  check(still.length === 0, "ready requests leave the agent inbox");
}

if (step === "propose") await proposeStep();
else await inboxStep();
