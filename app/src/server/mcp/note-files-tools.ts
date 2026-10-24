import { z } from "zod";
import {
  DOC_FILE_MAX_BYTES,
  MAX_FILES_PER_CALL,
  openAiFileArg,
  storeFiles,
} from "./note-files";
import { attachToNote } from "./notes-write";
import { ConnectorError, noteIdArg } from "./shared";
import type { ToolRegistrar } from "./tool-registry";

// Attaching files to notes. ChatGPT hands the files the user gave it to
// `files` (see openAiFileArg); other clients send base64 data or a url.

export function registerNoteFileTools(tools: ToolRegistrar): void {
  const { ctx } = tools;

  tools.write(
    "notes_attach_file",
    {
      title: "Attach file",
      description: `Keep a file with a note: a PDF, spreadsheet, slide deck, document, zip, audio, or any other file, up to ${DOC_FILE_MAX_BYTES / 1e6} MB each. Pass files (files the user uploaded or shared in this chat, up to ${MAX_FILES_PER_CALL}), data (base64 or a data: URL, with name), or url (a public http(s) address the server downloads, so the note keeps its own copy). With noteId, the files are added to that note as attachment cards, at the end or after afterBlockId; this works on any note, including the user's, because it only adds blocks, and a file already on the note is not added twice. Without noteId, nothing changes: put each returned markdown line in notes_create, notes_append, or notes_edit_blocks. Pictures (PNG, JPEG, GIF, WebP, AVIF, HEIC, BMP) show inline in the note unless display is "file". Tell the user what was attached and give the note's appUrl.`,
      input: {
        files: z
          .array(openAiFileArg)
          .max(MAX_FILES_PER_CALL)
          .optional()
          .describe("Files the user uploaded or shared in the chat"),
        data: z
          .string()
          .optional()
          .describe("File bytes as base64, or a data: URL"),
        url: z
          .string()
          .url()
          .optional()
          .describe("Public http(s) address of the file to download"),
        name: z
          .string()
          .max(200)
          .optional()
          .describe(
            "File name with extension, such as q3-report.pdf (for data or url)",
          ),
        mimeType: z
          .string()
          .max(120)
          .optional()
          .describe("Type of data, when name has no extension"),
        noteId: noteIdArg
          .optional()
          .describe(
            "Note to attach the files to; leave out to only store them",
          ),
        afterBlockId: z
          .string()
          .optional()
          .describe(
            "With noteId: insert after this block id from notes_get instead of at the end",
          ),
        display: z
          .enum(["auto", "file"])
          .optional()
          .describe(
            'auto (default) shows pictures inline; "file" keeps every file as a download card',
          ),
      },
      openWorld: true,
      fileParams: ["files"],
    },
    async ({ noteId, afterBlockId, ...source }) => {
      if (afterBlockId && !noteId) {
        throw new ConnectorError("invalid", "afterBlockId needs noteId");
      }
      const attached = await storeFiles(ctx, source);
      if (!noteId) return { attached };
      const note = await attachToNote(ctx, {
        id: noteId,
        markdown: attached.map((file) => file.markdown),
        afterBlockId,
      });
      const { blockIds, alreadyAttached, ...noteResult } = note;
      return {
        attached: attached.map((file, i) => ({
          ...file,
          blockId: blockIds[i],
          ...(alreadyAttached.includes(file.src)
            ? { alreadyAttached: true }
            : {}),
        })),
        note: noteResult,
      };
    },
  );
}
