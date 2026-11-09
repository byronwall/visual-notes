import { z } from "zod";
import { locateQuote, nodeText } from "~/lib/annotations/anchor";
import type { NoteNode } from "~/lib/note-content/types";
import { readAgentInbox } from "~/server/annotations/agent-inbox";
import { BUILT_IN, builtInTypeId } from "~/server/annotations/annotation-types";
import { createAnnotation } from "~/server/annotations/annotations";
import { AnnotationError } from "~/server/annotations/errors";
import { createProposal } from "~/server/annotations/proposals";
import {
  claimRequest,
  replyToRequest,
  touchRequestByAgent,
} from "~/server/annotations/requests";
import { prisma } from "~/server/db";
import { readNoteContent } from "~/server/notes/note-store";
import { contentFromMarkdown } from "./note-content";
import { storeInlineImages } from "./note-images";
import {
  agentContext,
  appLink,
  noteAppUrl,
  noteIdArg,
  parseSince,
} from "./shared";
import type { ToolRegistrar } from "./tool-registry";

// Annotations, requests, and proposed edits: the agent side of the user's
// inbox. These tools work on the user's notes because they never change the
// note body; the user accepts or rejects what they propose.

export const ANNOTATION_INSTRUCTIONS = [
  "Inbox: the user leaves requests for agents on notes, passages, and tasks. When asked to check the inbox, call inbox_get (pass the last pollSince as since), then for each request: inbox_claim it (skip it if another agent holds it), do the work, and inbox_reply with what you did and ready: true. Answer a question in the reply; put longer output in a note you create and link it. To change a note the user wrote, call notes_propose_edits with the requestId; the user accepts each edit inline. Use notes_annotate to point at a passage. Annotate or propose edits only when the user asked for it. Open research comments come back too; resolve them with research_resolve_comments.",
].join(" ");

export function registerAnnotationTools(tools: ToolRegistrar): void {
  const { ctx } = tools;
  const agent = () => ctx.clientName || "Agent";

  tools.read(
    "inbox_get",
    {
      title: "Read the inbox",
      description:
        "The user's open requests for agents, oldest first: what they asked (ask), where (a whole note, a passage with its blockId, or a task), the reply thread, other annotations on the same note, and who has claimed it. Also open research comments. Pass since (the pollSince of your last call) to get only what changed. Requests that are ready for review or closed are left out.",
      input: {
        since: z
          .string()
          .optional()
          .describe("ISO time; only requests and comments changed after it"),
      },
    },
    async (args) =>
      readAgentInbox({
        since: parseSince(args.since, "since") ?? undefined,
        links: {
          note: (id) => noteAppUrl(ctx, id),
          tasks: (listId) => appLink(ctx, `/tasks?list=${listId}`),
          research: (slug) => appLink(ctx, `/research/${slug}`),
        },
      }),
  );

  tools.write(
    "inbox_claim",
    {
      title: "Claim a request",
      description:
        "Take an open request so other agents skip it. Refused when another agent holds it (a claim lapses after 24 hours with no reply) or when it is ready or closed. Claiming one you already hold is fine.",
      input: { id: z.string().min(1).describe("Request id from inbox_get") },
      idempotent: true,
    },
    async (args) => {
      const request = await claimRequest({ id: args.id, agent: agent(), context: agentContext(ctx) });
      return { id: request.id, status: request.status, claimedBy: request.claimedBy };
    },
  );

  tools.write(
    "inbox_reply",
    {
      title: "Reply to a request",
      description:
        "Add a reply to a request's thread: what you did, the answer, links to notes you made, or a question for the user. ready: true hands it back to the user for review; only the user closes it. A reply claims the request if nobody holds it.",
      input: {
        id: z.string().min(1).describe("Request id from inbox_get"),
        message: z.string().min(1).max(4000),
        ready: z.boolean().optional().describe("The work is done; the user should review it"),
      },
    },
    async (args) => {
      const request = await replyToRequest({
        id: args.id,
        body: args.message,
        author: agent(),
        ready: args.ready,
        context: agentContext(ctx),
      });
      return { id: request.id, status: request.status, replies: request.messages.length };
    },
  );

  tools.write(
    "notes_annotate",
    {
      title: "Annotate a note",
      description:
        "Leave a comment on any note, the user's included, without changing its text. Give blockId and quote (exact text inside that block, from notes_get) to highlight a passage, or neither for a comment on the whole note. Pass requestId when this answers an inbox request. Annotate only when the user asked for it.",
      input: {
        noteId: noteIdArg,
        comment: z.string().min(1).max(4000),
        blockId: z.string().optional(),
        quote: z.string().max(1000).optional().describe("Exact text in the block to highlight"),
        requestId: z.string().optional(),
      },
    },
    async (args) => {
      const passage = args.blockId ? await findPassage(args.noteId, args.blockId, args.quote) : null;
      const annotation = await createAnnotation({
        docId: args.noteId,
        typeId: await builtInTypeId(BUILT_IN.fromAi),
        body: args.comment,
        author: agent(),
        blockId: passage?.blockId ?? null,
        quote: passage?.quote ?? null,
        quoteStart: passage?.quoteStart ?? null,
        context: agentContext(ctx),
      });
      if (args.requestId) await touchRequestByAgent(args.requestId, agent());
      return {
        id: annotation.id,
        noteId: args.noteId,
        appUrl: noteAppUrl(ctx, args.noteId) + (passage ? `#b-${passage.blockId}` : ""),
      };
    },
  );

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
        requestId: z
          .string()
          .optional()
          .describe("The inbox request these edits answer"),
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
        author: agent(),
        summary: args.summary,
        requestId: args.requestId,
        edits,
        context: agentContext(ctx),
      });
      if (args.requestId) await touchRequestByAgent(args.requestId, agent());
      return {
        id: proposal.id,
        noteId: proposal.docId,
        pending: proposal.ops.length,
        appUrl: noteAppUrl(ctx, proposal.docId),
      };
    },
  );
}

/** The block and offset of an agent's quote, refusing text that is not there. */
async function findPassage(noteId: string, blockId: string, quote: string | undefined) {
  if (!quote?.trim()) throw new AnnotationError("quote is required with blockId");
  const doc = await prisma.doc.findUnique({
    where: { id: noteId },
    select: { content: true, html: true, markdown: true },
  });
  if (!doc) throw new AnnotationError(`No note with id ${noteId}`);
  let block: NoteNode | null = null;
  const visit = (node: NoteNode) => {
    if (block) return;
    if (node.attrs?.id === blockId) block = node;
    else node.content?.forEach(visit);
  };
  visit(readNoteContent(doc));
  if (!block) throw new AnnotationError(`Unknown block id ${blockId}. Call notes_get again for current ids.`);
  const text = nodeText(block);
  const start = locateQuote(text, quote, 0);
  if (start === null) {
    throw new AnnotationError(`quote is not in block ${blockId}. Its text is: ${text.slice(0, 300)}`);
  }
  return { blockId, quote, quoteStart: start };
}
