import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ACTIVITY_INSTRUCTIONS, registerActivityTools } from "./activity-tools";
import { ARCHIVE_INSTRUCTIONS, registerArchiveTools } from "./archive-tools";
import {
  COLLECTION_INSTRUCTIONS,
  registerCollectionTools,
} from "./collections-tools";
import { EVENT_INSTRUCTIONS, registerEventTools } from "./event-tools";
import {
  NOTE_CONTEXT_INSTRUCTIONS,
  registerNoteContextTools,
} from "./notes-context-tools";
import { NOTE_INSTRUCTIONS, registerNoteTools } from "./notes-tools";
import { registerResearchTools, RESEARCH_INSTRUCTIONS } from "./research-tools";
import type { ConnectorContext } from "./shared";
import { registerTaskTools, TASK_INSTRUCTIONS } from "./tasks-tools";
import {
  registerTimeBlockTools,
  TIME_BLOCK_INSTRUCTIONS,
} from "./time-blocks-tools";
import { createToolRegistrar } from "./tool-registry";

// The connector's tool surface, one family per file. Tools are named
// `<area>_<verb>[_<object>]`; `search` is the one cross-area entry point.

const SERVER_INSTRUCTIONS = [
  "Visual Notes is the user's knowledge base: markdown notes filed by dot path (`work.visual-notes.canvas`), plus research topics, task lists, collections, a time-blocks calendar, events, and a web archive.",
  "Tools are named <area>_<verb>: notes_, research_, tasks_, collections_, time_blocks_, events_, places_, archive_, activity_. `search` looks across areas. In every result, appUrl opens the record in Visual Notes and url is a web address; ids you pass back are id/ids for the tool's own records and noteId, listId, showId, … for others.",
  NOTE_INSTRUCTIONS,
  "Rules: change the body, title, or path only of notes you created (notes_get says editable). For the user's notes, create a new note that links to the original. Metadata (note meta, task status and dates, collection values, event decisions) can change on any record. Deleting is the user's: cancel tasks and shows, hide research cards, or remove notes from a collection instead.",
  NOTE_CONTEXT_INSTRUCTIONS,
  RESEARCH_INSTRUCTIONS,
  TASK_INSTRUCTIONS,
  COLLECTION_INSTRUCTIONS,
  TIME_BLOCK_INSTRUCTIONS,
  EVENT_INSTRUCTIONS,
  ARCHIVE_INSTRUCTIONS,
  ACTIVITY_INSTRUCTIONS,
].join("\n");

export function createNotesMcpServer(ctx: ConnectorContext): McpServer {
  const server = new McpServer(
    { name: "visual-notes", version: "2.0.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );
  const tools = createToolRegistrar(server, ctx);
  registerNoteTools(tools);
  registerNoteContextTools(tools);
  registerResearchTools(tools);
  registerTaskTools(tools);
  registerCollectionTools(tools);
  registerTimeBlockTools(tools);
  registerEventTools(tools);
  registerArchiveTools(tools);
  registerActivityTools(tools);
  return server;
}
