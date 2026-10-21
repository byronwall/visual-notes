import { z } from "zod";
import { logResearchEvent } from "~/services/research/research.activity";
import { ingestTree, setCardStates } from "~/services/research/research.ingest";
import { createTopic, listTopics } from "~/services/research/research.store";
import {
  RESEARCH_CARD_STATES,
  RESEARCH_CARD_TYPES,
} from "~/services/research/research.types";
import {
  formatCard,
  formatTopicOutline,
  formatTopicSummary,
} from "./research-format";
import {
  agentArg,
  batchKeyArg,
  requireGraph,
  topicAppUrl,
  topicArg,
  writeBatch,
} from "./research-shared";
import { registerResearchEditTools } from "./research-tools-edit";
import { agentContext, ConnectorError } from "./shared";
import type { ToolRegistrar } from "./tool-registry";

// Research topics over the same connector as notes. Every card write is a
// batch (research-shared.ts writeBatch), so agent writes are validated,
// logged, and undoable from the topic's history.

export const RESEARCH_INSTRUCTIONS =
  "Research topics are canvases of tasks, questions, findings, sources, options, and criteria. Start with research_get_topic (summaries plus the open frontier), work an open card, record each round with one research_add_cards under that card, and mark finished work with research_set_card_states. Every write is a batch the user can undo.";

const cardTypes = RESEARCH_CARD_TYPES.filter((type) => type !== "summary") as [
  string,
  ...string[],
];
const cardShape = {
  type: z
    .enum(cardTypes)
    .describe("task | question | finding | source | option | criterion"),
  title: z.string().describe("One line. Full-sentence findings read best."),
  body: z.string().optional().describe("Markdown details."),
  state: z
    .enum(RESEARCH_CARD_STATES)
    .optional()
    .describe("Only for task/question. Defaults to open."),
  url: z.string().optional().describe("Web address, for sources."),
  snippet: z.string().optional().describe("A short quote worth keeping."),
  imageUrl: z.string().optional(),
  ref: z
    .string()
    .optional()
    .describe("Your label so links/summaries in this call can point at it."),
  children: z
    .array(z.any())
    .optional()
    .describe(
      "Cards that came from this one, same shape; nest as deep as needed.",
    ),
};

const ADD_CARDS_DESCRIPTION = `Add research cards, links, and draft summaries to a topic as one undoable batch; one card or only links is fine too.
Cards nest via "children" (came-from). Put new cards "under" an existing card id, usually the question or task you worked on.
In links and summaries.covers, point at cards by your "ref", a positional path ("$0" = first card, "$0.1" = its second child), or an existing card id.
Summaries land as drafts the user reviews; accepted summaries fold their cards on the canvas. Example:
{"topic":"learn-rust","under":"<question id>","batchKey":"rust-pin-1","summary":"Looked into Pin",
 "cards":[{"type":"finding","title":"Pin stops self-referential futures from moving","children":[{"type":"source","title":"std::pin docs","url":"https://doc.rust-lang.org/std/pin/"},{"type":"question","title":"When is Unpin implied?"}]}],
 "summaries":[{"title":"Pinning basics","covers":["$0","$0.0"]}]}`;

export function registerResearchTools(tools: ToolRegistrar): void {
  const { ctx } = tools;

  tools.read(
    "research_list_topics",
    {
      title: "List research topics",
      description:
        "Research topics with open counts, card counts, top summary, and link. Archived topics are left out unless includeArchived.",
      input: { includeArchived: z.boolean().optional() },
    },
    async ({ includeArchived }) => ({
      topics: (await listTopics({ includeArchived })).map((topic) => ({
        ...topic,
        appUrl: topicAppUrl(ctx, topic.slug),
      })),
    }),
  );

  tools.write(
    "research_create_topic",
    {
      title: "Create research topic",
      description:
        "Create a research topic (one canvas). Returns its id, slug, and link.",
      input: { title: z.string().min(1).max(200) },
    },
    async ({ title }) => {
      const topic = await createTopic({ title });
      await logResearchEvent(
        "research.topic_created",
        topic,
        {},
        agentContext(ctx),
      );
      return { ...topic, appUrl: topicAppUrl(ctx, topic.slug) };
    },
  );

  tools.read(
    "research_get_topic",
    {
      title: "Get research topic",
      description:
        'A topic as markdown with card ids. "summary" (default): summaries, the open frontier (tasks and questions) with the chain each came from, and recent batches. "full": every card as an outline.',
      input: {
        topic: topicArg,
        depth: z.enum(["summary", "full"]).optional(),
      },
    },
    async ({ topic, depth }) => {
      const graph = await requireGraph(topic);
      return {
        id: graph.topic.id,
        title: graph.topic.title,
        appUrl: topicAppUrl(ctx, graph.topic.slug),
        markdown:
          depth === "full"
            ? formatTopicOutline(graph)
            : formatTopicSummary(graph),
      };
    },
  );

  tools.read(
    "research_get_card",
    {
      title: "Get research card",
      description:
        "One card in full: body, the chain it came from, what it led to, and what a summary covers.",
      input: { topic: topicArg, id: z.string().min(1).describe("Card id") },
    },
    async ({ topic, id }) => {
      const graph = await requireGraph(topic);
      const markdown = formatCard(graph, id);
      if (!markdown)
        throw new ConnectorError("not_found", `No card "${id}" in this topic.`);
      return { id, markdown, appUrl: topicAppUrl(ctx, graph.topic.slug) };
    },
  );

  tools.write(
    "research_add_cards",
    {
      title: "Add research cards",
      description: ADD_CARDS_DESCRIPTION,
      input: {
        topic: topicArg,
        under: z
          .string()
          .optional()
          .describe("Existing card id the top-level cards came from."),
        agent: agentArg,
        batchKey: batchKeyArg,
        summary: z
          .string()
          .max(500)
          .optional()
          .describe("One line describing this round of work."),
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
              covers: z
                .array(z.string())
                .describe("Cards this summary condenses."),
              ref: z.string().optional(),
            }),
          )
          .optional()
          .describe("Draft summaries for the user to review."),
      },
    },
    ({ topic, agent, batchKey, ...payload }) =>
      writeBatch(
        ctx,
        {
          topic,
          agent,
          batchKey,
          kind: payload.cards?.length ? "ingest" : "link",
          summary: payload.summary,
        },
        (topicId, batch) => ingestTree(topicId, { ...payload, ...batch }),
      ),
  );

  tools.write(
    "research_set_card_states",
    {
      title: "Set research card states",
      description:
        "Mark tasks/questions open, done, or dropped, as one undoable batch.",
      input: {
        topic: topicArg,
        changes: z
          .array(
            z.object({ id: z.string(), state: z.enum(RESEARCH_CARD_STATES) }),
          )
          .min(1),
        agent: agentArg,
        batchKey: batchKeyArg,
      },
      idempotent: true,
    },
    ({ topic, changes, agent, batchKey }) =>
      writeBatch(
        ctx,
        { topic, agent, batchKey, kind: "state", cardCount: changes.length },
        (topicId, batch) => setCardStates(topicId, { ...batch, changes }),
      ),
  );

  registerResearchEditTools(tools);
}
