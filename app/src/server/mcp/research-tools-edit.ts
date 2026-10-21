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
import { redoBatch, undoBatch } from "~/services/research/research.ingest";
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

// Editing, removing, and undoing research work, plus topic rename/archive.
// Edits and removals are batches, so the user can undo them from history
// like any agent write. Reviewing summaries stays with the user.

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
        "Rename a topic and/or archive it (archived topics drop out of research_list_topics unless includeArchived).",
      input: {
        topic: topicArg,
        title: z.string().min(1).max(200).optional(),
        archived: z.boolean().optional(),
      },
      idempotent: true,
    },
    async ({ topic, title, archived }) => {
      const found = await requireTopic(topic);
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
      return { ...updated, appUrl: topicAppUrl(ctx, updated.slug) };
    },
  );

  tools.write(
    "research_update_cards",
    {
      title: "Update research cards",
      description:
        "Change the title, body, url, snippet, or imageUrl of existing cards as one undoable batch. Fields you leave out stay as they are; pass null to clear url/snippet/imageUrl.",
      input: {
        topic: topicArg,
        agent: agentArg,
        batchKey: batchKeyArg,
        edits: z
          .array(
            z.object({
              id: z.string().min(1),
              title: z.string().min(1).max(300).optional(),
              body: z.string().max(20_000).optional(),
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
        (topicId, batch) => editCards(topicId, { ...batch, edits }),
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
}
