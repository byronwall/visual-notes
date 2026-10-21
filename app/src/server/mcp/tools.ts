import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  getNotes,
  listNotePaths,
  listRecentNotes,
  MAX_NOTES_PER_GET,
  searchNotes,
} from "./notes-read";
import { ConnectorError, type ConnectorContext } from "./notes-shared";
import { appendToNote, createNote, editNote, updateNote } from "./notes-write";
import {
  EVENT_INSTRUCTIONS,
  EVENT_TOOL_SCOPES,
  registerEventTools,
} from "./event-tools";
import {
  registerResearchTools,
  RESEARCH_INSTRUCTIONS,
  RESEARCH_TOOL_SCOPES,
} from "./research-tools";
import {
  COLLECTION_INSTRUCTIONS,
  COLLECTION_TOOL_SCOPES,
  registerCollectionTools,
} from "./collections-tools";
import {
  registerTaskTools,
  TASK_INSTRUCTIONS,
  TASK_TOOL_SCOPES,
} from "./tasks-tools";
import {
  NOTE_CONTEXT_INSTRUCTIONS,
  NOTE_CONTEXT_TOOL_SCOPES,
  registerNoteContextTools,
} from "./notes-context-tools";
import {
  registerTimeBlockTools,
  TIME_BLOCK_INSTRUCTIONS,
  TIME_BLOCK_TOOL_SCOPES,
} from "./time-blocks-tools";
import {
  ARCHIVE_INSTRUCTIONS,
  ARCHIVE_TOOL_SCOPES,
  registerArchiveTools,
} from "./archive-tools";
import {
  ACTIVITY_INSTRUCTIONS,
  ACTIVITY_TOOL_SCOPES,
  registerActivityTools,
} from "./activity-tools";
import { SEARCH_KINDS, searchOtherKinds } from "./search-groups";

const LOG_PREFIX = "[mcp]";

const SERVER_INSTRUCTIONS = [
  "Visual Notes is the user's knowledge base: markdown notes filed by dot path (`work.visual-notes.canvas`), plus research topics, task lists, collections, a time-blocks calendar, and a web archive.",
  "Find: search with a few keywords (retry with synonyms; add include for research, tasks, or archive), list_recent for time-based questions, then get_notes for full content.",
  "Save: call list_paths, pick the best existing path or a sensible new sub-path, then create_note. Tell the user the title, path, and url.",
  "Edit: get_notes ends each block with a ` ^blockId` tag (on the next line for code blocks and tables). Use edit_note with those ids to change only those blocks. Never send ^id tags back.",
  "Markdown, both ways: [[Label|noteId]] or [[Label|noteId#blockId]] links a note (it must exist); #tag (starting with a letter) tags a block; a top-level `- [ ] task` / `- [x] task` line is a real task in the Inbox whose checkbox sets its status; `{{collection-view:viewId}}` on its own line is an embedded table, so keep it in place. Write \\# or \\[ for a literal character.",
  "Rules: change the body, title, or path only of notes you created (get_notes says editable). For the user's notes, create a new note that links to the original. Metadata (note meta, task status and dates, collection values) can change on any record. Deleting is the user's: cancel tasks, hide research cards, or remove notes from a collection instead.",
  RESEARCH_INSTRUCTIONS,
  TASK_INSTRUCTIONS,
  COLLECTION_INSTRUCTIONS,
  NOTE_CONTEXT_INSTRUCTIONS,
  TIME_BLOCK_INSTRUCTIONS,
  ARCHIVE_INSTRUCTIONS,
  ACTIVITY_INSTRUCTIONS,
  EVENT_INSTRUCTIONS,
].join("\n");

async function run(
  tool: string,
  fn: () => Promise<unknown>,
): Promise<CallToolResult> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    console.info(`${LOG_PREFIX} ${tool} ok in ${Date.now() - startedAt}ms`);
    const structured = Array.isArray(result)
      ? { results: result }
      : (result as Record<string, unknown>);
    return {
      content: [{ type: "text", text: JSON.stringify(structured, null, 2) }],
      structuredContent: structured,
    };
  } catch (error) {
    if (error instanceof ConnectorError) {
      console.info(`${LOG_PREFIX} ${tool} refused: ${error.code}`);
      return {
        isError: true,
        content: [{ type: "text", text: `${error.code}: ${error.message}` }],
      };
    }
    console.error(`${LOG_PREFIX} ${tool} failed`, error);
    return {
      isError: true,
      content: [
        { type: "text", text: "Internal error while handling the request." },
      ],
    };
  }
}

export const TOOL_SCOPES: Record<string, string> = {
  search: "notes:read",
  list_recent: "notes:read",
  list_paths: "notes:read",
  get_notes: "notes:read",
  create_note: "notes:write",
  update_note: "notes:write",
  append_to_note: "notes:write",
  edit_note: "notes:write",
  ...RESEARCH_TOOL_SCOPES,
  ...TASK_TOOL_SCOPES,
  ...COLLECTION_TOOL_SCOPES,
  ...NOTE_CONTEXT_TOOL_SCOPES,
  ...TIME_BLOCK_TOOL_SCOPES,
  ...ARCHIVE_TOOL_SCOPES,
  ...ACTIVITY_TOOL_SCOPES,
  ...EVENT_TOOL_SCOPES,
};

/** ChatGPT shows its account-linking UI only for this result shape. */
function insufficientScope(
  ctx: ConnectorContext,
  scope: string,
): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `This action needs the ${scope} permission. Reconnect Visual Notes to grant it.`,
      },
    ],
    _meta: { "mcp/www_authenticate": [ctx.scopeChallenge] },
  };
}

function guarded(
  ctx: ConnectorContext,
  tool: string,
  fn: () => Promise<unknown>,
): Promise<CallToolResult> {
  const scope = TOOL_SCOPES[tool];
  if (scope && !ctx.scopes.includes(scope)) {
    console.info(`${LOG_PREFIX} ${tool} refused: missing ${scope}`);
    return Promise.resolve(insufficientScope(ctx, scope));
  }
  return run(tool, fn);
}

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;
const write = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
} as const;

export function createNotesMcpServer(ctx: ConnectorContext): McpServer {
  const server = new McpServer(
    { name: "visual-notes", version: "1.0.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    "search",
    {
      title: "Search notes",
      description:
        "Search notes by keywords and, when embeddings are configured, by meaning. Each result says how it matched; use get_notes for full content. With include, the response is { notes, research?, tasks?, archive? }: one group per kind, matched by the words.",
      inputSchema: {
        query: z.string().min(1).describe("Keywords to look for"),
        path: z
          .string()
          .optional()
          .describe("Limit notes to this dot path and its children"),
        limit: z.number().int().min(1).max(25).optional(),
        include: z
          .array(z.enum(SEARCH_KINDS))
          .optional()
          .describe(
            "Also search research cards, tasks, and/or archived web pages",
          ),
      },
      annotations: readOnly,
    },
    ({ include, ...args }) =>
      guarded(ctx, "search", async () => {
        if (!include?.length) return searchNotes(ctx, args);
        const [notes, others] = await Promise.all([
          searchNotes(ctx, args),
          searchOtherKinds(ctx, {
            query: args.query,
            include,
            limit: args.limit ?? 10,
          }),
        ]);
        return { notes, ...others };
      }),
  );

  server.registerTool(
    "list_recent",
    {
      title: "List recent notes",
      description:
        "Notes ordered by last update, newest first. Use for 'what did I save this week' style questions.",
      inputSchema: {
        since: z
          .string()
          .optional()
          .describe("ISO date or datetime; only notes updated after this"),
        path: z
          .string()
          .optional()
          .describe("Limit to this dot path and its children"),
        createdBy: z
          .enum(["chatgpt", "any"])
          .optional()
          .describe("'chatgpt' for notes saved through this connector"),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: readOnly,
    },
    (args) => guarded(ctx, "list_recent", () => listRecentNotes(ctx, args)),
  );

  server.registerTool(
    "list_paths",
    {
      title: "List note paths",
      description:
        "The dot-path tree with note counts (`notes` directly at the path, `total` including children). Call before filing a new note.",
      inputSchema: {
        prefix: z
          .string()
          .optional()
          .describe("Only this path and its descendants"),
      },
      annotations: readOnly,
    },
    (args) => guarded(ctx, "list_paths", () => listNotePaths(args)),
  );

  server.registerTool(
    "get_notes",
    {
      title: "Get notes",
      description: `Full markdown for up to ${MAX_NOTES_PER_GET} notes by id, with a ^id tag on each block for edit_note, plus meta, collection values, and embeds. 'editable' says whether you may change the body, title, or path.`,
      inputSchema: {
        ids: z.array(z.string().min(1)).min(1).max(MAX_NOTES_PER_GET),
      },
      annotations: readOnly,
    },
    (args) => guarded(ctx, "get_notes", () => getNotes(ctx, args)),
  );

  server.registerTool(
    "create_note",
    {
      title: "Create note",
      description:
        "Save a new markdown note. Any dot path is allowed, including new ones. Pass idempotencyKey to make retries safe.",
      inputSchema: {
        title: z.string().min(1).max(200),
        path: z
          .string()
          .max(512)
          .optional()
          .describe("Dot path such as work.projects.alpha"),
        markdown: z.string().min(1),
        idempotencyKey: z
          .string()
          .max(200)
          .optional()
          .describe("Same key returns the first note instead of a duplicate"),
      },
      annotations: write,
    },
    (args) => guarded(ctx, "create_note", () => createNote(ctx, args)),
  );

  server.registerTool(
    "update_note",
    {
      title: "Update note",
      description:
        "Replace the title, path, and/or full markdown of a note you created. The previous version is kept for rollback.",
      inputSchema: {
        id: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        path: z.string().max(512).optional(),
        markdown: z
          .string()
          .min(1)
          .optional()
          .describe("Full replacement content"),
      },
      annotations: { ...write, idempotentHint: true },
    },
    (args) => guarded(ctx, "update_note", () => updateNote(ctx, args)),
  );

  server.registerTool(
    "append_to_note",
    {
      title: "Append to note",
      description:
        "Add markdown to the end of a note you created, e.g. a running log. The previous version is kept for rollback.",
      inputSchema: { id: z.string().min(1), markdown: z.string().min(1) },
      annotations: write,
    },
    (args) => guarded(ctx, "append_to_note", () => appendToNote(ctx, args)),
  );

  server.registerTool(
    "edit_note",
    {
      title: "Edit note blocks",
      description:
        "Change specific blocks of a note you created, by the block ids from get_notes. replace and insert_after take markdown; delete takes only the id. Other blocks are left exactly as they are. The previous version is kept for rollback.",
      inputSchema: {
        id: z.string().min(1),
        edits: z
          .array(
            z.object({
              op: z.enum(["replace", "insert_after", "delete"]),
              blockId: z.string().min(1),
              markdown: z
                .string()
                .optional()
                .describe("New content for replace / insert_after"),
            }),
          )
          .min(1)
          .max(50),
      },
      annotations: write,
    },
    (args) => guarded(ctx, "edit_note", () => editNote(ctx, args)),
  );

  registerResearchTools(server, ctx, guarded);
  registerTaskTools(server, ctx, guarded);
  registerCollectionTools(server, ctx, guarded);
  registerNoteContextTools(server, ctx, guarded);
  registerTimeBlockTools(server, ctx, guarded);
  registerArchiveTools(server, ctx, guarded);
  registerActivityTools(server, ctx, guarded);
  registerEventTools(server, ctx, guarded);

  return server;
}
