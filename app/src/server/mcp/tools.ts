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
import { appendToNote, createNote, updateNote } from "./notes-write";
import {
  registerResearchTools,
  RESEARCH_INSTRUCTIONS,
  RESEARCH_TOOL_SCOPES,
} from "./research-tools";

const LOG_PREFIX = "[mcp]";

const SERVER_INSTRUCTIONS = [
  "Visual Notes is the user's personal knowledge base. Notes are markdown documents organized by dot paths such as `work.visual-notes.canvas`.",
  "To save something: call list_paths first, choose the most fitting existing path (or a sensible new sub-path), then create_note. Tell the user the title, path, and url.",
  "To find something: use search with a few keywords (retry with synonyms if empty), list_recent for time-based questions, and get_notes to load full content.",
  "You may only update or append to notes with createdBy=chatgpt. For notes the user wrote, create a new note that links to the original.",
  RESEARCH_INSTRUCTIONS,
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
  ...RESEARCH_TOOL_SCOPES,
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
        "Search notes by keywords and, when embeddings are configured, by meaning. Each result says how it matched; use get_notes for full content.",
      inputSchema: {
        query: z.string().min(1).describe("Keywords to look for"),
        path: z
          .string()
          .optional()
          .describe("Limit to this dot path and its children"),
        limit: z.number().int().min(1).max(25).optional(),
      },
      annotations: readOnly,
    },
    (args) => guarded(ctx, "search", () => searchNotes(ctx, args)),
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
      description: `Full markdown for up to ${MAX_NOTES_PER_GET} notes by id. 'editable' tells whether you may update the note.`,
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
        "Replace the title, path, and/or full markdown of a note created by ChatGPT. The previous version is kept for rollback.",
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
        "Add markdown to the end of a note created by ChatGPT, e.g. a running log. The previous version is kept for rollback.",
      inputSchema: { id: z.string().min(1), markdown: z.string().min(1) },
      annotations: write,
    },
    (args) => guarded(ctx, "append_to_note", () => appendToNote(ctx, args)),
  );

  registerResearchTools(server, ctx, guarded);

  return server;
}
