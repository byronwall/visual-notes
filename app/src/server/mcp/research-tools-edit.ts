import { z } from "zod";
import {
  logResearchEvent,
  logUndoRedo,
} from "~/services/research/research.activity";
import {
  editCards,
  removeCards,
  updateTopic,
} from "~/services/research/research.edits";
import { resolveComments } from "~/services/research/research.comments";
import { redoBatch, undoBatch } from "~/services/research/research.ingest";
import { setupTopic } from "~/services/research/research.setup";
import { findBatch } from "~/services/research/research.store";
import { formatBatches } from "./research-format";
import {
  agentArg,
  batchKeyArg,
  requireGraph,
  requireTopic,
  topicAppUrl,
  topicArg,
  writeBatch,
} from "./research-shared";
import { agentContext, ConnectorError } from "./shared";
import type { ToolRegistrar } from "./tool-registry";

// Editing, removing, and undoing research work, the topic's frame (streams,
// kinds, answer), rename/archive, and resolving the user's comments. Edits,
// removals, and frame changes are batches the user can undo from history.

const streamShape = z.object({
  key: z.string().describe("Stable lowercase key, e.g. choose"),
  title: z
    .string()
    .max(120)
    .optional()
    .describe("Column title; required for a new stream"),
  goal: z
    .string()
    .max(600)
    .optional()
    .describe("What this stream is trying to settle, one sentence"),
  answer: z
    .string()
    .max(20_000)
    .optional()
    .describe("The stream's current answer (markdown); keep it current"),
  order: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Column position; new streams go last"),
});

const kindShape = z.object({
  key: z.string().describe("Lowercase key cards use, e.g. carrier"),
  label: z.string().describe("Shown on cards, e.g. Carrier"),
  role: z.enum([
    "question",
    "finding",
    "option",
    "task",
    "criterion",
    "source",
  ]),
  fields: z
    .array(z.object({ key: z.string(), label: z.string() }))
    .max(8)
    .optional()
    .describe("Columns for this kind, e.g. price, status"),
});

export function registerResearchEditTools(tools: ToolRegistrar): void {
  const { ctx } = tools;

  tools.read(
    "research_list_batches",
    {
      title: "List research history",
      description:
        "A topic's write history, newest first (up to 50): who wrote each batch, what it did, and whether it is undone.",
      input: { topic: topicArg },
    },
    async ({ topic }) => ({
      batches: formatBatches(await requireGraph(topic)),
    }),
  );

  tools.write(
    "research_update_topic",
    {
      title: "Update research topic",
      description:
        "Set a topic's frame and keep it current: streams (upserted by key: title, goal, answer, order), removeStreams, kinds (replaces the list), and the topic answer, as one undoable batch. Also renames or archives the topic. Returns warnings about the topic as a whole.",
      input: {
        topic: topicArg,
        title: z.string().min(1).max(200).optional(),
        archived: z.boolean().optional(),
        streams: z.array(streamShape).max(10).optional(),
        removeStreams: z.array(z.string()).max(10).optional(),
        kinds: z.array(kindShape).max(12).optional(),
        answer: z
          .string()
          .max(20_000)
          .optional()
          .describe("The topic's current answer (markdown)"),
        agent: agentArg,
        batchKey: batchKeyArg,
      },
      idempotent: true,
    },
    async ({
      topic,
      title,
      archived,
      streams,
      removeStreams,
      kinds,
      answer,
      agent,
      batchKey,
    }) => {
      const found = await requireTopic(topic);
      // Check the rename before the frame batch commits, so a bad title can't
      // leave a saved frame behind an error.
      if (title !== undefined && !title.trim()) {
        throw new ConnectorError("invalid", "title cannot be empty");
      }
      const framed =
        streams?.length ||
        removeStreams?.length ||
        kinds ||
        answer !== undefined
          ? await writeBatch(
              ctx,
              { topic, agent, batchKey, kind: "setup", summary: "topic frame" },
              (topicId, batch) =>
                setupTopic(topicId, {
                  ...batch,
                  streams,
                  removeStreams,
                  kinds: kinds?.map((kind) => ({
                    ...kind,
                    fields: kind.fields ?? [],
                  })),
                  answer,
                }),
            )
          : null;
      if (title === undefined && archived === undefined) {
        if (!framed) {
          throw new ConnectorError(
            "invalid",
            "Pass streams, removeStreams, kinds, answer, title, or archived.",
          );
        }
        return framed;
      }
      const updated = await updateTopic(found.id, { title, archived });
      const change = [
        title ? "renamed" : null,
        archived === undefined ? null : archived ? "archived" : "unarchived",
      ]
        .filter(Boolean)
        .join(", ");
      await logResearchEvent(
        "research.topic_updated",
        updated,
        { change },
        agentContext(ctx),
      );
      return { ...framed, ...updated, appUrl: topicAppUrl(ctx, updated.slug) };
    },
  );

  tools.write(
    "research_update_cards",
    {
      title: "Update research cards",
      description:
        "Change existing cards as one undoable batch: title, gist, body, url, snippet, imageUrl, kind, fields, stream, or parent (move the card under another card, or null for a root). Fields you leave out stay as they are; pass null to clear url/snippet/imageUrl/kind/stream. Returns warnings about the cards you touched.",
      input: {
        topic: topicArg,
        agent: agentArg,
        batchKey: batchKeyArg,
        edits: z
          .array(
            z.object({
              id: z.string().min(1),
              title: z.string().min(1).max(300).optional(),
              gist: z.string().max(600).optional(),
              body: z.string().max(20_000).optional(),
              kind: z.string().max(40).nullable().optional(),
              fields: z
                .record(
                  z.union([z.string(), z.number(), z.boolean(), z.null()]),
                )
                .nullable()
                .optional()
                .describe("Replaces the card's field values"),
              stream: z.string().max(40).nullable().optional(),
              parent: z
                .string()
                .min(1)
                .nullable()
                .optional()
                .describe("Card id to move under, or null to make it a root"),
              url: z.string().max(2000).nullable().optional(),
              snippet: z.string().max(2000).nullable().optional(),
              imageUrl: z.string().max(2000).nullable().optional(),
            }),
          )
          .min(1)
          .max(100),
      },
    },
    ({ topic, agent, batchKey, edits }) =>
      writeBatch(
        ctx,
        { topic, agent, batchKey, kind: "edit", cardCount: edits.length },
        (topicId, batch) =>
          editCards(topicId, {
            ...batch,
            edits: edits.map(({ parent, ...edit }) => ({
              ...edit,
              ...(parent === undefined ? {} : { parentId: parent }),
            })),
          }),
      ),
  );

  tools.write(
    "research_remove_cards",
    {
      title: "Remove research cards",
      description:
        "Hide cards as one undoable batch. A card that still has cards under it can only be removed together with them; pass every id.",
      input: {
        topic: topicArg,
        ids: z.array(z.string().min(1)).min(1).max(500),
        agent: agentArg,
        batchKey: batchKeyArg,
      },
      destructive: true,
    },
    ({ topic, ids, agent, batchKey }) =>
      writeBatch(
        ctx,
        { topic, agent, batchKey, kind: "remove", cardCount: ids.length },
        (topicId, batch) => removeCards(topicId, { ...batch, ids }),
      ),
  );

  const registerUndoRedo = (
    name: "research_undo_batch" | "research_redo_batch",
  ) => {
    const undo = name === "research_undo_batch";
    tools.write(
      name,
      {
        title: undo ? "Undo research batch" : "Redo research batch",
        description: undo
          ? "Undo one batch (yours or anyone's): hide the cards it added and revert its state changes, edits, and removals. Refused while later batches build on it."
          : "Restore an undone batch. Refused while a batch it builds on is still undone.",
        input: {
          topic: topicArg,
          batch: z
            .string()
            .min(1)
            .describe("Batch id or batchKey (from research_list_batches)"),
        },
      },
      async ({ topic, batch }) => {
        const found = await requireTopic(topic);
        // Not from the topic graph, which only carries the newest 50 batches.
        const match = await findBatch(found.id, batch);
        if (!match) {
          throw new ConnectorError(
            "not_found",
            `No batch "${batch}" in this topic. Use research_list_batches.`,
          );
        }
        const result = undo
          ? await undoBatch(match.id)
          : await redoBatch(match.id);
        if (!result.ok) {
          const blockers = result.blockingBatchIds.length
            ? ` Blocking batches: ${result.blockingBatchIds.join(", ")}`
            : "";
          throw new ConnectorError("invalid", `${result.reason}${blockers}`);
        }
        await logUndoRedo(
          match.id,
          undo ? "research.batch_undone" : "research.batch_redone",
          agentContext(ctx),
        );
        return {
          batchId: match.id,
          undone: undo,
          appUrl: topicAppUrl(ctx, found.slug),
        };
      },
    );
  };
  registerUndoRedo("research_undo_batch");
  registerUndoRedo("research_redo_batch");

  tools.write(
    "research_resolve_comments",
    {
      title: "Resolve research comments",
      description:
        "Mark the user's comments (listed in research_get_topic) resolved after you act on them, each with a short note saying what you changed. resolved: false reopens them.",
      input: {
        topic: topicArg,
        resolutions: z
          .array(
            z.object({
              id: z.string().min(1),
              note: z.string().max(4000).optional(),
            }),
          )
          .min(1)
          .max(100),
        resolved: z.boolean().optional(),
      },
      idempotent: true,
    },
    async ({ topic, resolutions, resolved }) => {
      const found = await requireTopic(topic);
      const result = await resolveComments(found.id, { resolutions, resolved });
      return { ...result, appUrl: topicAppUrl(ctx, found.slug) };
    },
  );
}
