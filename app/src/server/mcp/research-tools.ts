import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { listFrontier } from "~/services/research/research.graph";
import { ingestTree, ResearchIngestError, setCardStates } from "~/services/research/research.ingest";
import { createTopic, listTopics, loadTopicGraph, resolveTopic } from "~/services/research/research.store";
import { RESEARCH_CARD_STATES, RESEARCH_CARD_TYPES } from "~/services/research/research.types";
import { batchPayload, logResearchEvent } from "~/services/research/research.activity";
import { ConnectorError, type ConnectorContext } from "./notes-shared";
import { formatCard, formatTopicOutline, formatTopicSummary } from "./research-format";
import { registerResearchEditTools, RESEARCH_EDIT_TOOL_SCOPES } from "./research-tools-edit";

// Research topics over the same connector as notes. Every write goes through
// ingestTree or setCardStates, so agent writes are validated, batched, and
// undoable from the topic's history.

export const RESEARCH_TOOL_SCOPES: Record<string, string> = {
  research_list_topics: "notes:read",
  research_read_topic: "notes:read",
  research_list_frontier: "notes:read",
  research_get_card: "notes:read",
  research_create_topic: "notes:write",
  research_ingest_tree: "notes:write",
  research_add_card: "notes:write",
  research_link_cards: "notes:write",
  research_set_state: "notes:write",
  ...RESEARCH_EDIT_TOOL_SCOPES,
};

export const RESEARCH_INSTRUCTIONS = [
  "Research topics are canvases of tasks, questions, findings, sources, options, and criteria, linked by what each came from.",
  "Start with research_list_topics or research_read_topic (summaries plus the open frontier). Work on an open card, then record what you found with one research_ingest_tree under that card per round of work. Mark finished work with research_set_state.",
].join("\n");

type Guarded = (ctx: ConnectorContext, tool: string, fn: () => Promise<unknown>) => Promise<CallToolResult>;

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

const topicArg = z.string().min(1).describe("Topic id or slug (from research_list_topics).");
const agentArg = z
  .string()
  .max(100)
  .optional()
  .describe('Who is writing, shown in topic history, e.g. "claude-code". Defaults to the connected client.');
const batchKeyArg = z
  .string()
  .max(200)
  .optional()
  .describe("Idempotency key. Reuse it when retrying the same write; omit for a fresh one.");

const cardTypes = RESEARCH_CARD_TYPES.filter((type) => type !== "summary") as [string, ...string[]];
const cardShape = {
  type: z.enum(cardTypes).describe("task | question | finding | source | option | criterion"),
  title: z.string().describe("One line. Full-sentence findings read best."),
  body: z.string().optional().describe("Markdown details."),
  state: z.enum(RESEARCH_CARD_STATES).optional().describe("Only for task/question. Defaults to open."),
  url: z.string().optional().describe("For sources."),
  snippet: z.string().optional().describe("A short quote worth keeping."),
  imageUrl: z.string().optional(),
  ref: z.string().optional().describe("Your label so links/summaries in this call can point at it."),
  children: z.array(z.any()).optional().describe("Cards that came from this one, same shape; nest as deep as needed."),
};

const INGEST_DESCRIPTION = `Add a tree of research cards to a topic as one undoable batch.
Cards nest via "children" (came-from). Put new cards "under" an existing card id, usually the question or task you worked on.
In links and summaries.covers, point at cards by your "ref", a positional path ("$0" = first card, "$0.1" = its second child), or an existing card id.
Summaries land as drafts the user reviews; accepted summaries fold their cards on the canvas. Example:
{"topic":"learn-rust","under":"<question id>","batchKey":"rust-pin-1","summary":"Looked into Pin",
 "cards":[{"type":"finding","title":"Pin stops self-referential futures from moving","children":[{"type":"source","title":"std::pin docs","url":"https://doc.rust-lang.org/std/pin/"},{"type":"question","title":"When is Unpin implied?"}]}],
 "summaries":[{"title":"Pinning basics","covers":["$0","$0.0"]}]}`;

const topicUrl = (ctx: ConnectorContext, slug: string) => `${ctx.origin}/research/${slug}`;

const requireTopic = async (topic: string) => {
  const found = await resolveTopic(topic);
  if (!found) throw new ConnectorError("not_found", `No topic "${topic}". Use research_list_topics.`);
  return found;
};

const requireGraph = async (topic: string) => {
  const graph = await loadTopicGraph(topic);
  if (!graph) throw new ConnectorError("not_found", `No topic "${topic}". Use research_list_topics.`);
  return graph;
};

/** Validation problems become a refusal the agent can fix and retry. */
const asConnectorError = async <T>(work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ResearchIngestError) {
      throw new ConnectorError(
        "invalid",
        `Nothing was written. Fix these and retry:\n${error.issues.map((issue) => `- ${issue}`).join("\n")}`,
      );
    }
    throw error;
  }
};

export function registerResearchTools(server: McpServer, ctx: ConnectorContext, guarded: Guarded): void {
  const agentOf = (agent: string | undefined) => agent?.trim() || ctx.actorId;
  const context = { actorId: ctx.actorId, actorType: "chatgpt" as const };
  /** Logs a batch the agent just wrote (replays were logged the first time). */
  const logBatch = async (
    topic: { id: string; slug: string; title: string },
    result: { batchId: string; batchKey: string; replayed: boolean; cardCount: number },
    agent: string,
    kind: string,
    summary?: string,
  ) => {
    if (result.replayed) return;
    await logResearchEvent("research.batch_added", topic, batchPayload(result, { agent, kind, summary }), context);
  };

  server.registerTool(
    "research_list_topics",
    {
      title: "List research topics",
      description: "Research topics with open counts, card counts, top summary, and link. Archived topics are left out unless includeArchived.",
      inputSchema: { includeArchived: z.boolean().optional() },
      annotations: readOnly,
    },
    ({ includeArchived }) =>
      guarded(ctx, "research_list_topics", async () =>
        (await listTopics({ includeArchived })).map((topic) => ({ ...topic, url: topicUrl(ctx, topic.slug) })),
      ),
  );

  server.registerTool(
    "research_create_topic",
    {
      title: "Create research topic",
      description: "Create a research topic (one canvas). Returns its id, slug, and link.",
      inputSchema: { title: z.string().min(1).max(200) },
      annotations: write,
    },
    ({ title }) =>
      guarded(ctx, "research_create_topic", async () => {
        const topic = await createTopic({ title });
        await logResearchEvent("research.topic_created", topic, {}, context);
        return { ...topic, url: topicUrl(ctx, topic.slug) };
      }),
  );

  server.registerTool(
    "research_read_topic",
    {
      title: "Read research topic",
      description:
        'Read a topic as markdown with card ids. "summary" (default): summaries, the open frontier with pedigree, recent batches. "full": every card as an outline.',
      inputSchema: { topic: topicArg, depth: z.enum(["summary", "full"]).optional() },
      annotations: readOnly,
    },
    ({ topic, depth }) =>
      guarded(ctx, "research_read_topic", async () => {
        const graph = await requireGraph(topic);
        return {
          url: topicUrl(ctx, graph.topic.slug),
          markdown: depth === "full" ? formatTopicOutline(graph) : formatTopicSummary(graph),
        };
      }),
  );

  server.registerTool(
    "research_list_frontier",
    {
      title: "List open research work",
      description: "Open tasks and questions in a topic, each with the chain of cards it came from.",
      inputSchema: { topic: topicArg },
      annotations: readOnly,
    },
    ({ topic }) =>
      guarded(ctx, "research_list_frontier", async () =>
        listFrontier(await requireGraph(topic)).map(({ card, pedigree }) => ({
          id: card.id,
          type: card.type,
          title: card.title,
          cameFrom: pedigree.map((p) => ({ id: p.id, title: p.title })),
        })),
      ),
  );

  server.registerTool(
    "research_get_card",
    {
      title: "Get research card",
      description: "One card in full: body, pedigree, what it led to, and what a summary covers.",
      inputSchema: { topic: topicArg, id: z.string().min(1) },
      annotations: readOnly,
    },
    ({ topic, id }) =>
      guarded(ctx, "research_get_card", async () => {
        const markdown = formatCard(await requireGraph(topic), id);
        if (!markdown) throw new ConnectorError("not_found", `No card "${id}" in this topic.`);
        return { markdown };
      }),
  );

  server.registerTool(
    "research_ingest_tree",
    {
      title: "Add research findings",
      description: INGEST_DESCRIPTION,
      inputSchema: {
        topic: topicArg,
        under: z.string().optional().describe("Existing card id the top-level cards came from."),
        agent: agentArg,
        batchKey: batchKeyArg,
        summary: z.string().max(500).optional().describe("One line describing this round of work."),
        cards: z.array(z.object(cardShape)).optional(),
        links: z
          .array(z.object({ from: z.string(), to: z.string() }))
          .optional()
          .describe("Relates-to links between cards (refs, $paths, or ids)."),
        summaries: z
          .array(
            z.object({
              title: z.string(),
              body: z.string().optional(),
              covers: z.array(z.string()).describe("Cards this summary condenses."),
              ref: z.string().optional(),
            }),
          )
          .optional()
          .describe("Draft summaries for the user to review."),
      },
      annotations: write,
    },
    ({ topic, agent, batchKey, ...payload }) =>
      guarded(ctx, "research_ingest_tree", async () => {
        const found = await requireTopic(topic);
        const who = agentOf(agent);
        const result = await asConnectorError(() =>
          ingestTree(found.id, { ...payload, agent: who, batchKey: batchKey || randomUUID() }),
        );
        await logBatch(found, result, who, "ingest", payload.summary);
        return { ...result, url: topicUrl(ctx, found.slug) };
      }),
  );

  server.registerTool(
    "research_add_card",
    {
      title: "Add research card",
      description: "Add one card. A shortcut for a one-card research_ingest_tree.",
      inputSchema: {
        topic: topicArg,
        under: z.string().optional().describe("Existing card id this came from."),
        agent: agentArg,
        batchKey: batchKeyArg,
        ...cardShape,
      },
      annotations: write,
    },
    ({ topic, under, agent, batchKey, ...card }) =>
      guarded(ctx, "research_add_card", async () => {
        const found = await requireTopic(topic);
        const who = agentOf(agent);
        const result = await asConnectorError(() =>
          ingestTree(found.id, { under, agent: who, batchKey: batchKey || randomUUID(), cards: [card] }),
        );
        await logBatch(found, result, who, "ingest", card.title);
        return result;
      }),
  );

  server.registerTool(
    "research_link_cards",
    {
      title: "Link research cards",
      description: "Record that two existing cards relate. Does not change what either came from.",
      inputSchema: { topic: topicArg, from: z.string(), to: z.string(), agent: agentArg, batchKey: batchKeyArg },
      annotations: write,
    },
    ({ topic, from, to, agent, batchKey }) =>
      guarded(ctx, "research_link_cards", async () => {
        const found = await requireTopic(topic);
        const who = agentOf(agent);
        const result = await asConnectorError(() =>
          ingestTree(found.id, { agent: who, batchKey: batchKey || randomUUID(), links: [{ from, to }] }),
        );
        await logBatch(found, result, who, "link");
        return result;
      }),
  );

  server.registerTool(
    "research_set_state",
    {
      title: "Set research card state",
      description: "Mark tasks/questions open, done, or dropped, as one undoable batch.",
      inputSchema: {
        topic: topicArg,
        changes: z.array(z.object({ id: z.string(), state: z.enum(RESEARCH_CARD_STATES) })).min(1),
        agent: agentArg,
        batchKey: batchKeyArg,
      },
      annotations: write,
    },
    ({ topic, changes, agent, batchKey }) =>
      guarded(ctx, "research_set_state", async () => {
        const found = await requireTopic(topic);
        const who = agentOf(agent);
        const result = await asConnectorError(() =>
          setCardStates(found.id, { agent: who, batchKey: batchKey || randomUUID(), changes }),
        );
        await logBatch(found, { ...result, cardCount: changes.length }, who, "state");
        return result;
      }),
  );

  registerResearchEditTools(server, ctx, guarded, {
    asConnectorError,
    topicUrl: (slug) => topicUrl(ctx, slug),
  });
}
