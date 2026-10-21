import { z } from "zod";
import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import { listBacklinks } from "~/server/notes/note-links";
import {
  listMetaKeys,
  listMetaValues,
  readMeta,
  updateNotesMeta,
  type MetaAction,
} from "~/server/notes/note-meta";
import {
  listNoteRevisions,
  restoreNoteRevision,
} from "~/server/notes/note-revisions";
import { listTagBlocks, listTags } from "~/server/notes/note-views";
import { scheduleEmbeddingRefresh } from "~/server/notes/embedding-refresh";
import {
  agentContext,
  CHATGPT_SOURCE,
  ConnectorError,
  isAgentNote,
  noteAppUrl,
  noteIdArg,
  requireNotes,
  type ConnectorContext,
} from "./shared";
import type { ToolRegistrar } from "./tool-registry";

// What surrounds a note: who links to it, tags, its version history, and its
// meta fields. Agents may restore versions only of notes they created; meta
// can change on any note, like a task's status. Open task lines in notes are
// tasks_query with inNotes.

export const NOTE_CONTEXT_INSTRUCTIONS =
  "Around a note: notes_get_backlinks, notes_list_tags, notes_list_revisions / notes_restore_revision (your notes only), and notes_list_meta_keys / notes_set_meta for `meta` fields on any note.";

const metaValue = z.union([
  z.string().max(4000),
  z.number(),
  z.boolean(),
  z.null(),
]);
const metaKeyArg = z.string().min(1).max(128);

async function requireNote(id: string) {
  const doc = await prisma.doc.findUnique({
    where: { id },
    select: { id: true, title: true, originalSource: true },
  });
  if (!doc) throw new ConnectorError("not_found", `No note with id ${id}`);
  return doc;
}

/** A per-note group from the note views, keyed the way agents read notes. */
const asNoteGroup = <T extends { docId: string }>(
  ctx: ConnectorContext,
  { docId, ...group }: T,
) => ({ noteId: docId, ...group, appUrl: noteAppUrl(ctx, docId) });

export function registerNoteContextTools(tools: ToolRegistrar): void {
  const { ctx } = tools;

  tools.read(
    "notes_get_backlinks",
    {
      title: "Get backlinks",
      description:
        "Notes that link to this note (or to a block in it), each with the linking blocks' text.",
      input: { id: noteIdArg },
    },
    async ({ id }) => {
      await requireNote(id);
      const backlinks = await listBacklinks(id);
      return { backlinks: backlinks.map((group) => asNoteGroup(ctx, group)) };
    },
  );

  tools.read(
    "notes_list_tags",
    {
      title: "List tags",
      description:
        "Without tag: every #tag in use with block and note counts, most used first. With tag: the blocks carrying it, grouped by note (newest first), with block ids for notes_get / notes_edit_blocks.",
      input: {
        tag: z.string().max(80).optional().describe("A tag, with or without #"),
      },
    },
    async ({ tag }) => {
      const name = tag?.trim().replace(/^#/, "");
      if (!name) return { tags: await listTags() };
      const groups = await listTagBlocks(name);
      return {
        tag: name,
        notes: groups.map(({ items, ...group }) => ({
          ...asNoteGroup(ctx, group),
          blocks: items.map(({ blockId, type, text }) => ({
            blockId,
            type,
            text,
          })),
        })),
      };
    },
  );

  tools.read(
    "notes_list_revisions",
    {
      title: "List note versions",
      description:
        "Saved earlier versions of a note, newest first, with why each was kept (chatgpt.update, restore, merge-conflict, …).",
      input: { id: noteIdArg },
    },
    async ({ id }) => {
      const doc = await requireNote(id);
      return {
        id,
        editable: isAgentNote(doc),
        revisions: await listNoteRevisions(id),
      };
    },
  );

  tools.write(
    "notes_restore_revision",
    {
      title: "Restore note version",
      description:
        "Put an earlier version (from notes_list_revisions) back as the title, path, and content of a note you created. The current version is kept first, so a restore can be undone.",
      input: { id: noteIdArg, revisionId: z.string().min(1) },
    },
    async ({ id, revisionId }) => {
      const doc = await requireNote(id);
      if (!isAgentNote(doc)) {
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
          `No version ${revisionId} of this note. Use notes_list_revisions.`,
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
        context: agentContext(ctx),
      });
      scheduleEmbeddingRefresh();
      return {
        id,
        title: restored.title,
        path: restored.path,
        appUrl: noteAppUrl(ctx, id),
      };
    },
  );

  tools.read(
    "notes_list_meta_keys",
    {
      title: "List meta keys",
      description:
        "Without key: every `meta` field name in use with note counts, most used first. With key: the values it holds, as text, with counts. Check before notes_set_meta to reuse existing names and values.",
      input: { key: metaKeyArg.optional() },
    },
    async ({ key }) =>
      key
        ? { key, values: await listMetaValues(key) }
        : { keys: await listMetaKeys() },
  );

  tools.write(
    "notes_set_meta",
    {
      title: "Set note meta",
      description:
        "Set or remove `meta` fields (flat key → string/number/boolean) on up to 50 notes, including notes the user wrote. Content is not touched.",
      input: {
        ids: z.array(z.string().min(1)).min(1).max(50),
        set: z
          .record(metaKeyArg, metaValue)
          .optional()
          .describe("Fields to set; other fields stay"),
        remove: z
          .array(metaKeyArg)
          .optional()
          .describe("Field names to delete"),
      },
      idempotent: true,
    },
    async ({ ids, set, remove }) => {
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
      await requireNotes(unique);
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
          context: agentContext(ctx),
        });
      }
      const rows = await prisma.doc.findMany({
        where: { id: { in: updated } },
        select: { id: true, title: true, meta: true },
      });
      return {
        notes: rows.map((row) => ({
          id: row.id,
          title: row.title,
          meta: readMeta(row.meta),
          appUrl: noteAppUrl(ctx, row.id),
        })),
      };
    },
  );
}
