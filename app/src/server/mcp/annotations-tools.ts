import { z } from "zod";
import { createProposal } from "~/server/annotations/proposals";
import { contentFromMarkdown } from "./note-content";
import { storeInlineImages } from "./note-images";
import { agentContext, noteAppUrl, noteIdArg } from "./shared";
import type { ToolRegistrar } from "./tool-registry";

// Annotations, requests, and proposed edits: the agent side of the user's
// inbox. These tools work on the user's notes because they never change the
// note body; the user accepts or rejects what they propose.

export const ANNOTATION_INSTRUCTIONS =
  "Proposed edits: to change a note the user wrote, call notes_propose_edits with block ids from notes_get. The user sees each edit inline and accepts or rejects it. Propose edits only when the user asked for a change.";

export function registerAnnotationTools(tools: ToolRegistrar): void {
  const { ctx } = tools;

  tools.write(
    "notes_propose_edits",
    {
      title: "Propose note edits",
      description:
        "Suggest block edits to any note, the user's included, by the block ids from notes_get. Nothing changes until the user accepts: each edit shows inline in the note with Accept and Reject. replace and insert_after take markdown; delete takes only the blockId. Use this only when the user asked for the change (for example a request to expand or fix a passage). For notes you created, notes_edit_blocks changes them directly.",
      input: {
        id: noteIdArg,
        summary: z
          .string()
          .max(500)
          .optional()
          .describe("One line on what the edits do, shown above them"),
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
    async (args) => {
      const edits = await Promise.all(
        args.edits.map(async (edit) => ({
          op: edit.op,
          blockId: edit.blockId,
          blocks: edit.markdown?.trim()
            ? (contentFromMarkdown(await storeInlineImages(edit.markdown))
                .content ?? [])
            : undefined,
        })),
      );
      const proposal = await createProposal({
        docId: args.id,
        author: ctx.clientName || "Agent",
        summary: args.summary,
        edits,
        context: agentContext(ctx),
      });
      return {
        id: proposal.id,
        noteId: proposal.docId,
        pending: proposal.ops.length,
        appUrl: noteAppUrl(ctx, proposal.docId),
      };
    },
  );
}
