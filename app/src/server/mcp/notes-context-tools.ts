import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import { listBacklinks } from "~/server/notes/note-links";
import {
  readMeta,
  updateNotesMeta,
  type MetaAction,
} from "~/server/notes/note-meta";
import {
  listNoteRevisions,
  restoreNoteRevision,
} from "~/server/notes/note-revisions";
import {
  listOpenNoteTasks,
  listTagBlocks,
  listTags,
} from "~/server/notes/note-views";
import {
  CHATGPT_SOURCE,
  ConnectorError,
  isChatGptNote,
  noteUrl,
  type ConnectorContext,
} from "./notes-shared";
import { scheduleEmbeddingRefresh } from "./semantic";

// What surrounds a note: who links to it, tags, the open task lines in notes,
// its version history, and its meta fields. Agents may restore versions only
// of notes they created; meta can change on any note, like a task's status.

export const NOTE_CONTEXT_TOOL_SCOPES: Record<string, string> = {
  get_backlinks: "notes:read",
  list_tags: "notes:read",
  list_note_tasks: "notes:read",
  list_revisions: "notes:read",
  restore_revision: "notes:write",
  set_note_meta: "notes:write",
};

export const NOTE_CONTEXT_INSTRUCTIONS =
  "get_backlinks shows which notes link to a note; list_tags lists tags, or the blocks carrying one tag; list_note_tasks lists open task lines across notes. list_revisions and restore_revision roll back a note created by ChatGPT. get_notes returns each note's `meta` fields; set_note_meta changes them on any note.";

type Guarded = (
  ctx: ConnectorContext,
  tool: string,
  fn: () => Promise<unknown>,
) => Promise<CallToolResult>;

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

const metaValue = z.union([
  z.string().max(4000),
  z.number(),
  z.boolean(),
  z.null(),
]);

async function requireNote(id: string) {
  const doc = await prisma.doc.findUnique({
    where: { id },
    select: { id: true, title: true, originalSource: true },
  });
  if (!doc) throw new ConnectorError("not_found", `No note with id ${id}`);
  return doc;
}

export function registerNoteContextTools(
  server: McpServer,
  ctx: ConnectorContext,
  guarded: Guarded,
): void {
  const context = { actorId: ctx.actorId, actorType: "chatgpt" as const };
  const withUrl = <T extends { docId: string }>(group: T) => ({
    ...group,
    url: noteUrl(ctx, group.docId),
  });

  server.registerTool(
    "get_backlinks",
    {
      title: "Get backlinks",
      description:
        "Notes that link to this note (or to a block in it), each with the linking blocks' text.",
      inputSchema: { id: z.string().min(1).describe("Note id") },
      annotations: readOnly,
    },
    ({ id }) =>
      guarded(ctx, "get_backlinks", async () => {
        await requireNote(id);
        return (await listBacklinks(id)).map(withUrl);
      }),
  );

  server.registerTool(
    "list_tags",
    {
      title: "List tags",
      description:
        "Without tag: every #tag in use with block and note counts, most used first. With tag: the blocks carrying it, grouped by note (newest first), with block ids for get_notes/edit_note.",
      inputSchema: {
        tag: z.string().max(80).optional().describe("A tag, with or without #"),
      },
      annotations: readOnly,
    },
    ({ tag }) =>
      guarded(ctx, "list_tags", async () => {
        const name = tag?.trim().replace(/^#/, "");
        if (!name) return listTags();
        return (await listTagBlocks(name)).map(withUrl);
      }),
  );

  server.registerTool(
    "list_note_tasks",
    {
      title: "List open note tasks",
      description:
        "Open task lines written in notes, grouped by note (most recently edited first). Use tasks_query for list tasks and filters.",
      annotations: readOnly,
    },
    () =>
      guarded(ctx, "list_note_tasks", async () =>
        (await listOpenNoteTasks()).map(withUrl),
      ),
  );

  server.registerTool(
    "list_revisions",
    {
      title: "List note versions",
      description:
        "Saved earlier versions of a note, newest first, with why each was kept (chatgpt.update, restore, merge-conflict, …).",
      inputSchema: { id: z.string().min(1).describe("Note id") },
      annotations: readOnly,
    },
    ({ id }) =>
      guarded(ctx, "list_revisions", async () => {
        const doc = await requireNote(id);
        return {
          id,
          editable: isChatGptNote(doc),
          revisions: await listNoteRevisions(id),
        };
      }),
  );

  server.registerTool(
    "restore_revision",
    {
      title: "Restore note version",
      description:
        "Put an earlier version (from list_revisions) back as the title, path, and content of a note created by ChatGPT. The current version is kept first, so a restore can be undone.",
      inputSchema: {
        id: z.string().min(1).describe("Note id"),
        revisionId: z.string().min(1),
      },
      annotations: write,
    },
    ({ id, revisionId }) =>
      guarded(ctx, "restore_revision", async () => {
        const doc = await requireNote(id);
        if (!isChatGptNote(doc)) {
          throw new ConnectorError(
            "not_owner",
            "This note was written by the user; only they can restore its versions.",
          );
        }
        const revision = await prisma.docRevision.findUnique({
          where: { id: revisionId },
          select: { docId: true },
        });
        if (!revision || revision.docId !== id) {
          throw new ConnectorError(
            "not_found",
            `No version ${revisionId} of this note. Use list_revisions.`,
          );
        }
        const restored = await restoreNoteRevision(revisionId, "chatgpt");
        await logActionEvent({
          eventType: "doc.update",
          entityType: "doc",
          entityId: id,
          relatedDocId: id,
          payload: {
            source: CHATGPT_SOURCE,
            reason: "restore",
            restoredRevisionId: revisionId,
          },
          context,
        });
        scheduleEmbeddingRefresh();
        return {
          id,
          title: restored.title,
          path: restored.path,
          url: noteUrl(ctx, id),
        };
      }),
  );

  server.registerTool(
    "set_note_meta",
    {
      title: "Set note meta",
      description:
        "Set or remove `meta` fields (flat key → string/number/boolean) on up to 50 notes, including notes the user wrote. Content is not touched.",
      inputSchema: {
        ids: z.array(z.string().min(1)).min(1).max(50),
        set: z
          .record(z.string().min(1).max(128), metaValue)
          .optional()
          .describe("Fields to set; other fields stay"),
        remove: z
          .array(z.string().min(1).max(128))
          .optional()
          .describe("Field names to delete"),
      },
      annotations: { ...write, idempotentHint: true },
    },
    ({ ids, set, remove }) =>
      guarded(ctx, "set_note_meta", async () => {
        const actions: MetaAction[] = [
          ...Object.entries(set ?? {}).map(([key, value]) => ({
            type: "update" as const,
            key,
            value,
          })),
          ...(remove ?? []).map((key) => ({ type: "remove" as const, key })),
        ];
        if (!actions.length)
          throw new ConnectorError("invalid", "Pass set and/or remove.");
        const unique = Array.from(new Set(ids));
        const found = await prisma.doc.findMany({
          where: { id: { in: unique } },
          select: { id: true },
        });
        const missing = unique.filter(
          (id) => !found.some((doc) => doc.id === id),
        );
        if (missing.length)
          throw new ConnectorError(
            "not_found",
            `Nothing was changed. No notes with ids: ${missing.join(", ")}`,
          );
        const updated = await updateNotesMeta(unique, actions);
        for (const id of updated) {
          await logActionEvent({
            eventType: "doc.update",
            entityType: "doc",
            entityId: id,
            relatedDocId: id,
            payload: {
              source: CHATGPT_SOURCE,
              fieldsChanged: ["meta"],
              metaKeys: actions.map((a) => a.key),
            },
            context,
          });
        }
        const rows = await prisma.doc.findMany({
          where: { id: { in: updated } },
          select: { id: true, title: true, meta: true },
        });
        return rows.map((row) => ({
          id: row.id,
          title: row.title,
          meta: readMeta(row.meta),
        }));
      }),
  );
}
