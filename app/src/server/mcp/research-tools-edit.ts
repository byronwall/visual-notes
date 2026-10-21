import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { batchPayload, logResearchEvent, logUndoRedo } from "~/services/research/research.activity";
import { editCards, removeCards, updateTopic } from "~/services/research/research.edits";
import { redoBatch, undoBatch } from "~/services/research/research.ingest";
import { loadTopicGraph, resolveTopic } from "~/services/research/research.store";
import { ConnectorError, type ConnectorContext } from "./notes-shared";
import { formatBatches } from "./research-format";

// Editing, removing, and undoing research work, plus topic rename/archive.
// Edits and removals are batches, so the user can undo them from history
// like any agent write. Reviewing summaries stays with the user.

export const RESEARCH_EDIT_TOOL_SCOPES: Record<string, string> = {
  research_list_batches: "notes:read",
  research_update_topic: "notes:write",
  research_update_cards: "notes:write",
  research_remove_cards: "notes:write",
  research_undo_batch: "notes:write",
  research_redo_batch: "notes:write",
};

type Guarded = (ctx: ConnectorContext, tool: string, fn: () => Promise<unknown>) => Promise<CallToolResult>;
type Topic = { id: string; slug: string; title: string };

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

const topicArg = z.string().min(1).describe("Topic id or slug (from research_list_topics).");
const agentArg = z.string().max(100).optional().describe('Who is writing, shown in topic history, e.g. "claude-code".');
const batchKeyArg = z.string().max(200).optional().describe("Idempotency key. Reuse it when retrying the same write.");

type Run = <T>(work: () => Promise<T>) => Promise<T>;

export function registerResearchEditTools(
  server: McpServer,
  ctx: ConnectorContext,
  guarded: Guarded,
  helpers: { asConnectorError: Run; topicUrl: (slug: string) => string },
): void {
  const agentOf = (agent: string | undefined) => agent?.trim() || ctx.actorId;
  const context = { actorId: ctx.actorId, actorType: "chatgpt" as const };
  const requireTopic = async (topic: string): Promise<Topic> => {
    const found = await resolveTopic(topic);
    if (!found) throw new ConnectorError("not_found", `No topic "${topic}". Use research_list_topics.`);
    return found;
  };
  /** Accepts a batch id or the batchKey the agent used. */
  const resolveBatch = async (topic: Topic, batch: string) => {
    const graph = await loadTopicGraph(topic.id);
    const match = graph?.batches.find((b) => b.id === batch || b.batchKey === batch);
    if (!match) throw new ConnectorError("not_found", `No batch "${batch}" in this topic. Use research_list_batches.`);
    return match.id;
  };

  server.registerTool(
    "research_list_batches",
    {
      title: "List research history",
      description: "A topic's write history, newest first (up to 50): who wrote each batch, what it did, and whether it is undone.",
      inputSchema: { topic: topicArg },
      annotations: readOnly,
    },
    ({ topic }) =>
      guarded(ctx, "research_list_batches", async () => {
        const graph = await loadTopicGraph(topic);
        if (!graph) throw new ConnectorError("not_found", `No topic "${topic}". Use research_list_topics.`);
        return { batches: formatBatches(graph) };
      }),
  );

  server.registerTool(
    "research_update_topic",
    {
      title: "Rename or archive research topic",
      description: "Rename a topic and/or archive it (archived topics drop out of research_list_topics unless includeArchived).",
      inputSchema: {
        topic: topicArg,
        title: z.string().min(1).max(200).optional(),
        archived: z.boolean().optional(),
      },
      annotations: write,
    },
    ({ topic, title, archived }) =>
      guarded(ctx, "research_update_topic", async () => {
        const found = await requireTopic(topic);
        const updated = await helpers.asConnectorError(() => updateTopic(found.id, { title, archived }));
        const change = [title ? "renamed" : null, archived === undefined ? null : archived ? "archived" : "unarchived"]
          .filter(Boolean)
          .join(", ");
        await logResearchEvent("research.topic_updated", updated, { change }, context);
        return { ...updated, url: helpers.topicUrl(updated.slug) };
      }),
  );

  server.registerTool(
    "research_update_cards",
    {
      title: "Edit research cards",
      description:
        "Change the title, body, url, snippet, or imageUrl of existing cards as one undoable batch. Fields you leave out stay as they are; pass null to clear url/snippet/imageUrl.",
      inputSchema: {
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
      annotations: write,
    },
    ({ topic, agent, batchKey, edits }) =>
      guarded(ctx, "research_update_cards", async () => {
        const found = await requireTopic(topic);
        const who = agentOf(agent);
        const result = await helpers.asConnectorError(() =>
          editCards(found.id, { agent: who, batchKey: batchKey || randomUUID(), edits }),
        );
        if (!result.replayed) {
          await logResearchEvent(
            "research.batch_added",
            found,
            batchPayload({ ...result, cardCount: edits.length }, { agent: who, kind: "edit" }),
            context,
          );
        }
        return { ...result, editedCount: edits.length, url: helpers.topicUrl(found.slug) };
      }),
  );

  server.registerTool(
    "research_remove_cards",
    {
      title: "Remove research cards",
      description:
        "Hide cards as one undoable batch. A card that still has cards under it can only be removed together with them; pass every id.",
      inputSchema: {
        topic: topicArg,
        ids: z.array(z.string().min(1)).min(1).max(500),
        agent: agentArg,
        batchKey: batchKeyArg,
      },
      annotations: { ...write, destructiveHint: true },
    },
    ({ topic, ids, agent, batchKey }) =>
      guarded(ctx, "research_remove_cards", async () => {
        const found = await requireTopic(topic);
        const who = agentOf(agent);
        const result = await helpers.asConnectorError(() =>
          removeCards(found.id, { agent: who, batchKey: batchKey || randomUUID(), ids }),
        );
        if (!result.replayed) {
          await logResearchEvent(
            "research.batch_added",
            found,
            batchPayload({ ...result, cardCount: ids.length }, { agent: who, kind: "remove" }),
            context,
          );
        }
        return { ...result, removedCount: ids.length, url: helpers.topicUrl(found.slug) };
      }),
  );

  const registerUndoRedo = (name: "research_undo_batch" | "research_redo_batch") => {
    const undo = name === "research_undo_batch";
    server.registerTool(
      name,
      {
        title: undo ? "Undo research batch" : "Redo research batch",
        description: undo
          ? "Undo one batch (yours or anyone's): hide the cards it added and revert its state changes, edits, and removals. Refused while later batches build on it."
          : "Restore an undone batch. Refused while a batch it builds on is still undone.",
        inputSchema: {
          topic: topicArg,
          batch: z.string().min(1).describe("Batch id or batchKey (from research_list_batches)."),
        },
        annotations: write,
      },
      ({ topic, batch }) =>
        guarded(ctx, name, async () => {
          const found = await requireTopic(topic);
          const batchId = await resolveBatch(found, batch);
          const result = undo ? await undoBatch(batchId) : await redoBatch(batchId);
          if (!result.ok) {
            const blockers = result.blockingBatchIds.length ? ` Blocking batches: ${result.blockingBatchIds.join(", ")}` : "";
            throw new ConnectorError("invalid", `${result.reason}${blockers}`);
          }
          await logUndoRedo(batchId, undo ? "research.batch_undone" : "research.batch_redone", context);
          return { ok: true, batchId, url: helpers.topicUrl(found.slug) };
        }),
    );
  };
  registerUndoRedo("research_undo_batch");
  registerUndoRedo("research_redo_batch");
}
