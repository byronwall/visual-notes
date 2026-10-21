// End-to-end smoke for the MCP connector, driven by the official MCP client.
//
//   MCP_URL=http://127.0.0.1:3161/mcp MCP_BEARER=<token> \
//   node --experimental-strip-types scripts/mcp-smoke.ts \
//     [--human-note <id>] [--archive-page <id>]
//
// Checks the tool list and its naming, then runs the note tools in depth
// (create, update, append, block edit, search) and one read and one write
// for every other family. Everything it makes is named `mcp-smoke <run id>`. Deleting is
// human-only, so it cancels its task, removes its row from its collection,
// undoes its research card, and archives its topic; the notes, collection,
// time block, and event stay as named fixtures. With --human-note it checks that a
// user-written note is refused; with --archive-page it adds a note to that
// saved page. Run it only against a local or disposable database.
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

const EXPECTED_TOOL_COUNT = 63;
const FAMILIES = [
  "notes_",
  "research_",
  "tasks_",
  "collections_",
  "time_blocks_",
  "events_",
  "places_",
  "archive_",
  "activity_",
];
const tools = await client.listTools();
const toolNames = tools.tools.map((t) => t.name);
check(
  toolNames.length === EXPECTED_TOOL_COUNT,
  `lists ${EXPECTED_TOOL_COUNT} tools (got ${toolNames.length})`,
);
check(
  FAMILIES.every((prefix) => toolNames.some((n) => n.startsWith(prefix))),
  "every tool family is registered",
);
check(
  toolNames.every(
    (n) => n === "search" || FAMILIES.some((prefix) => n.startsWith(prefix)),
  ),
  "every tool but search is named <area>_<verb>",
);

const runId = `${Date.now()}`;
const fixture = `mcp-smoke ${runId}`;
const path = `mcp-smoke.run-${runId}`;
const key = `smoke-${runId}`;
const created = await call("notes_create", {
  title: `MCP smoke plan ${runId}`,
  path,
  markdown: "# Plan\n\n- first step",
  idempotencyKey: key,
});
const note = created.structuredContent;
check(
  !created.isError && note?.pathIsNew === true,
  "notes_create at a new path reports pathIsNew",
);

const retry = await call("notes_create", {
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

const updated = await call("notes_update", {
  id: note.id,
  markdown: "# Plan\n\n- first step\n- second step",
});
check(
  updated.structuredContent?.version === 2,
  "notes_update snapshots the prior version",
);

const appended = await call("notes_append", {
  id: note.id,
  markdown: "## Log\n\nAppended line",
});
check(
  appended.structuredContent?.version === 3,
  "notes_append snapshots again",
);

const fetched = await call("notes_get", { ids: [note.id] });
const markdown: string = fetched.structuredContent?.notes?.[0]?.markdown ?? "";
check(
  markdown.includes("second step") && markdown.includes("Appended line"),
  "notes_get returns the latest markdown",
);

// Block edit: change one block by its ^id and leave every other line as-is.
const tagged = markdown.split("\n");
const target = tagged.find((line) => line.includes("Appended line"));
const blockId = target?.match(/\^([A-Za-z0-9]+)\s*$/)?.[1];
check(Boolean(blockId), "notes_get tags blocks with ^ids");
const edited = await call("notes_edit_blocks", {
  id: note.id,
  edits: [{ op: "replace", blockId, markdown: "Edited by block id" }],
});
check(
  edited.structuredContent?.version === 4,
  "notes_edit_blocks snapshots again",
);
const refetched = await call("notes_get", { ids: [note.id] });
const after: string[] = (
  refetched.structuredContent?.notes?.[0]?.markdown ?? ""
).split("\n");
check(
  after.some((line) => line.startsWith("Edited by block id ^" + blockId)),
  "notes_edit_blocks replaced the block and kept its id",
);
check(
  tagged
    .filter((line) => line !== target)
    .every((line) => after.includes(line)),
  "notes_edit_blocks left every other block byte-identical",
);

const found = await call("search", { query: "MCP smoke plan" });
check(
  found.structuredContent?.notes?.some((r: { id: string }) => r.id === note.id),
  "search finds the new note",
);

const recent = await call("notes_query", { createdBy: "agent", limit: 5 });
check(
  recent.structuredContent?.notes?.[0]?.id === note.id,
  "notes_query shows it first",
);

const paths = await call("notes_list_paths", { prefix: "mcp-smoke" });
check(
  paths.structuredContent?.paths?.some(
    (p: { path: string }) => p.path === path,
  ),
  "notes_list_paths includes the new path",
);

if (humanNoteId) {
  const refused = await call("notes_update", {
    id: humanNoteId,
    title: "hijacked",
  });
  check(
    refused.isError && refused.content[0]?.text?.startsWith("not_owner"),
    "update of a user note is refused",
  );
}

// Note context: meta on the smoke note, then read it back by key.
const metaKey = `smoke${runId}`;
const meta = await call("notes_set_meta", {
  ids: [note.id],
  set: { [metaKey]: "yes" },
});
check(!meta.isError, "notes_set_meta writes a field");
const keys = await call("notes_list_meta_keys", { key: metaKey });
check(
  keys.structuredContent?.values?.[0]?.value === "yes",
  "notes_list_meta_keys reads it back",
);
const tags = await call("notes_list_tags", {});
check(!tags.isError, "notes_list_tags reads");

// Research: a topic with one card, then undo the card and archive the topic.
const topic = (await call("research_create_topic", { title: fixture }))
  .structuredContent;
check(Boolean(topic?.id), "research_create_topic");
const card = await call("research_add_cards", {
  topic: topic.id,
  cards: [{ type: "question", title: `Does the ${fixture} card show up?` }],
  agent: "mcp-smoke",
});
const read = await call("research_get_topic", { topic: topic.id });
check(
  String(read.structuredContent?.markdown ?? "").includes(fixture),
  "research_get_topic shows the new card",
);
const undone = await call("research_undo_batch", {
  topic: topic.id,
  batch: card.structuredContent?.batchId,
});
check(!undone.isError, "research_undo_batch hides it again");
const archived = await call("research_update_topic", {
  topic: topic.id,
  archived: true,
});
check(!archived.isError, "research_update_topic archives the topic");

// Tasks: create in the Inbox, find it, then cancel it.
const task = (
  await call("tasks_create", {
    description: `${fixture} task`,
    tags: ["smoke"],
  })
).structuredContent;
const tasks = await call("tasks_query", { text: fixture });
check(
  tasks.structuredContent?.tasks?.some(
    (t: { id: string }) => t.id === task?.id,
  ),
  "tasks_query finds the new task",
);
const cancelled = await call("tasks_update", {
  updates: [{ id: task?.id, status: "cancelled" }],
});
check(!cancelled.isError, "tasks_update cancels it");

// Collections: a collection with one row, queried by value, then removed.
const collection = (
  await call("collections_create", {
    name: fixture,
    properties: [{ name: "Score", kind: "number" }],
  })
).structuredContent;
const row = (
  await call("collections_add_row", {
    collection: collection?.id,
    title: `${fixture} row`,
    path,
    values: { Score: "3" },
  })
).structuredContent;
const rows = await call("collections_query", {
  collection: collection?.id,
  where: [{ property: "Score", op: "eq", value: 3 }],
});
check(
  rows.structuredContent?.rows?.[0]?.id === row?.id,
  "collections_query finds the row by value",
);
const removed = await call("collections_remove_notes", {
  collection: collection?.id,
  noteIds: [row?.id],
});
check(
  removed.structuredContent?.removed === 1,
  "collections_remove_notes takes it out",
);

// Time blocks: one block on a day nobody plans, linked to the smoke note.
const block = await call("time_blocks_create", {
  title: fixture,
  start: "2001-01-01T09:00:00Z",
  end: "2001-01-01T09:30:00Z",
  noteId: note.id,
});
check(!block.isError, "time_blocks_create");
const blocks = await call("time_blocks_query", {
  from: "2000-12-31",
  to: "2001-01-02",
  noteId: note.id,
});
check(
  blocks.structuredContent?.blocks?.some(
    (b: { id: string }) => b.id === block.structuredContent?.id,
  ),
  "time_blocks_query finds it by note",
);

// Events: one event on the smoke note's day nobody plans, found by query.
const event = await call("events_create", {
  title: `${fixture} event`,
  path,
  summary: "Smoke test event",
  shows: [{ date: "2001-01-01", time: "19:00" }],
  idempotencyKey: `${key}-event`,
});
check(!event.isError, "events_create");
const shows = await call("events_query", {
  from: "2001-01-01",
  to: "2001-01-01",
  search: fixture,
});
check(
  shows.structuredContent?.shows?.some(
    (s: { noteId: string }) => s.noteId === event.structuredContent?.noteId,
  ),
  "events_query finds its show",
);
const showId = event.structuredContent?.shows?.[0]?.showId;
const cancelledShow = await call("events_update_show", {
  showId,
  status: "cancelled",
});
check(!cancelledShow.isError, "events_update_show cancels the show");
const places = await call("places_list", { limit: 1 });
check(!places.isError, "places_list reads");

// Web archive: an unsaved url reads as not archived; a note only on request.
const unsaved = await call("archive_get", {
  url: `https://example.invalid/${path}`,
});
check(
  unsaved.structuredContent?.archived === false,
  "archive_get reports an unsaved url",
);
const archivePageIndex = process.argv.indexOf("--archive-page");
const archivePageId =
  archivePageIndex > 0 ? process.argv[archivePageIndex + 1] : undefined;
if (archivePageId) {
  const added = await call("archive_add_note", {
    pageId: archivePageId,
    text: fixture,
  });
  check(!added.isError, "archive_add_note");
}

// Activity: the smoke note's own history.
const history = await call("activity_query", { noteId: note.id });
check(
  history.structuredContent?.events?.some(
    (e: { type: string }) => e.type === "doc.create",
  ),
  "activity_query shows the note's history",
);

console.info(`[mcp-smoke] note ${note.appUrl}`);
await client.close();
