import { z } from "zod";
import {
  getNotes,
  listNotePaths,
  listRecentNotes,
  MAX_NOTES_PER_GET,
  searchNotes,
} from "./notes-read";
import { MAX_IMAGE_BYTES, uploadImage } from "./note-images";
import { openAiFileArg } from "./note-files";
import { appendToNote, createNote, editNote, updateNote } from "./notes-write";
import { SEARCH_KINDS, searchOtherKinds } from "./search-groups";
import { ConnectorError, limitArg, noteIdArg } from "./shared";
import type { ToolRegistrar } from "./tool-registry";

// Finding, reading, and writing notes. Agents change the body, title, or path
// only of notes they created; everything else about notes is in
// notes-context-tools.ts.

export const NOTE_INSTRUCTIONS = [
  "Find: `search` with a few keywords (retry with synonyms; add include for research, tasks, or archive), notes_query for time-based questions, then notes_get for full content.",
  "Save: reuse a path you already know (from search, notes_get, or earlier in the chat); call notes_list_paths only when unsure, then notes_create with the best existing path or a sensible new sub-path. Tell the user the title, path, and appUrl.",
  "Edit: notes_get ends each block with a ` ^blockId` tag (on the next line for code blocks and tables). Use notes_edit_blocks with those ids to change only those blocks. Never send ^id tags back.",
  "Files: to put a file the user gave you (PDF, spreadsheet, document, zip, image, ...) on a note, call notes_attach_file with it in files and the note's id; it works on any note, the user's included, and only adds a block. Without a note id it returns markdown like [report.pdf](/api/doc-files/…) to place on its own line in notes_create, notes_append, or notes_edit_blocks. notes_get lists a note's attachments with a url that downloads each one.",
  "Images: notes_upload_image stores an image (a file the user gave you, base64 data, or a public url the server downloads) and returns markdown like ![alt](/api/doc-images/…). Inline data:image urls in note markdown are stored the same way. Other image urls stay as links to that site.",
  "Markdown, both ways: [[Label|noteId]] or [[Label|noteId#blockId]] links a note (it must exist); #tag (starting with a letter) tags a block; a top-level `- [ ] task` / `- [x] task` line is a real task in the Inbox whose checkbox sets its status, so write one per commitment and put a procedure's steps in a numbered list under it (each write returns the note's tasks with ids; set a due day with tasks_update); `{{collection-view:viewId}}` on its own line is an embedded table, so keep it in place. Write \\# or \\[ for a literal character.",
].join("\n");

const markdownArg = z
  .string()
  .min(1)
  .describe("Markdown in the notes_get dialect, without ^id tags");
const pathArg = z
  .string()
  .max(512)
  .optional()
  .describe("Dot path such as work.projects.alpha");
const idempotencyKeyArg = z
  .string()
  .max(200)
  .optional()
  .describe("Same key returns the first record instead of a duplicate");

export function registerNoteTools(tools: ToolRegistrar): void {
  const { ctx } = tools;

  tools.read(
    "search",
    {
      title: "Search",
      description:
        "Search notes by keywords and, when embeddings are configured, by meaning. Each note says how it matched; use notes_get for full content. include adds research cards, tasks, and/or archived pages matched by the same words, each under its own key.",
      input: {
        query: z.string().min(1).describe("Keywords to look for"),
        path: z
          .string()
          .optional()
          .describe("Limit notes to this dot path and its children"),
        include: z
          .array(z.enum(SEARCH_KINDS))
          .optional()
          .describe("Also search research cards, tasks, and/or archived pages"),
        limit: limitArg(25, 10).describe(
          "Per kind; at most 25, defaults to 10",
        ),
      },
    },
    async ({ include, ...args }) => {
      const [notes, others] = await Promise.all([
        searchNotes(ctx, args),
        include?.length
          ? searchOtherKinds(ctx, {
              query: args.query,
              include,
              limit: args.limit ?? 10,
            })
          : {},
      ]);
      return { notes, ...others };
    },
  );

  tools.read(
    "notes_query",
    {
      title: "Query notes",
      description:
        "Notes by last update, newest first, filtered by date, path, and who wrote them. Use for 'what did I save this week' questions.",
      input: {
        since: z
          .string()
          .optional()
          .describe("ISO date or date-time; only notes updated after this"),
        path: z
          .string()
          .optional()
          .describe("Limit to this dot path and its children"),
        createdBy: z
          .enum(["agent", "user"])
          .optional()
          .describe("'agent' for notes saved through this connector"),
        limit: limitArg(100, 20),
      },
    },
    async (args) => ({ notes: await listRecentNotes(ctx, args) }),
  );

  tools.read(
    "notes_list_paths",
    {
      title: "List note paths",
      description:
        "The dot-path tree with note counts (`notes` directly at the path, `total` including children). Call before filing a new note.",
      input: {
        prefix: z
          .string()
          .optional()
          .describe("Only this path and its descendants"),
      },
    },
    async (args) => ({ paths: await listNotePaths(args) }),
  );

  tools.read(
    "notes_get",
    {
      title: "Get notes",
      description: `Full markdown for up to ${MAX_NOTES_PER_GET} notes by id, with a ^id tag on each block for notes_edit_blocks, plus meta, collection values, and embeds. 'editable' says whether you may change the body, title, or path. Ids that don't exist come back under missing.`,
      input: {
        ids: z.array(z.string().min(1)).min(1).max(MAX_NOTES_PER_GET),
      },
    },
    (args) => getNotes(ctx, args),
  );

  tools.write(
    "notes_create",
    {
      title: "Create note",
      description:
        "Save a new markdown note. Any dot path is allowed, including new ones. Pass idempotencyKey to make retries safe.",
      input: {
        title: z.string().min(1).max(200),
        path: pathArg,
        markdown: markdownArg,
        idempotencyKey: idempotencyKeyArg,
      },
    },
    (args) => createNote(ctx, args),
  );

  tools.write(
    "notes_upload_image",
    {
      title: "Upload image",
      description: `Store an image for use in notes and get back markdown to embed it. Pass file (an image the user gave you), data (base64 or a data: URL), or url (a public http(s) address the server downloads, so the note keeps its own copy). PNG, JPEG, GIF, WebP, AVIF, HEIC, or BMP, up to ${MAX_IMAGE_BYTES / 1e6} MB. The same bytes always give the same src. This does not change any note: put the returned markdown in notes_create, notes_append, or notes_edit_blocks.`,
      input: {
        file: openAiFileArg
          .optional()
          .describe("An image the user uploaded or shared in the chat"),
        data: z
          .string()
          .optional()
          .describe("Image bytes as base64, or a data:image/...;base64 URL"),
        url: z
          .string()
          .url()
          .optional()
          .describe("Public http(s) address of the image to download"),
        alt: z
          .string()
          .max(300)
          .optional()
          .describe("Alt text for the returned markdown"),
      },
      idempotent: true,
      openWorld: true,
      fileParams: ["file"],
    },
    async ({ file, ...args }) => {
      if (file && (args.data || args.url)) {
        throw new ConnectorError(
          "invalid",
          "Pass exactly one of file, data, or url.",
        );
      }
      return uploadImage(ctx, {
        ...args,
        url: file?.download_url ?? args.url,
        alt: args.alt ?? file?.file_name?.replace(/\.[a-z0-9]+$/i, ""),
      });
    },
  );

  tools.write(
    "notes_update",
    {
      title: "Update note",
      description:
        "Replace the title, path, and/or full markdown of a note you created. The previous version is kept (notes_list_revisions).",
      input: {
        id: noteIdArg,
        title: z.string().min(1).max(200).optional(),
        path: pathArg,
        markdown: markdownArg.optional().describe("Full replacement content"),
      },
      idempotent: true,
    },
    (args) => updateNote(ctx, args),
  );

  tools.write(
    "notes_append",
    {
      title: "Append to note",
      description:
        "Add markdown to the end of a note you created, e.g. a running log. The previous version is kept (notes_list_revisions).",
      input: { id: noteIdArg, markdown: markdownArg },
    },
    (args) => appendToNote(ctx, args),
  );

  tools.write(
    "notes_edit_blocks",
    {
      title: "Edit note blocks",
      description:
        "Change specific blocks of a note you created, by the block ids from notes_get. replace and insert_after take markdown; delete takes only the blockId. Other blocks are left exactly as they are. The previous version is kept (notes_list_revisions).",
      input: {
        id: noteIdArg,
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
    },
    (args) => editNote(ctx, args),
  );
}
