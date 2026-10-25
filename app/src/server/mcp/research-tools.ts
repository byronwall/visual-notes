import { z } from "zod";
import { logResearchEvent } from "~/services/research/research.activity";
import { ingestTree, setCardStates } from "~/services/research/research.ingest";
import { createTopic, listTopics } from "~/services/research/research.store";
import {
  RESEARCH_CARD_STATES,
  RESEARCH_CARD_TYPES,
  RESEARCH_LINK_KINDS,
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
  "Research topics are boards of questions, findings, options, tasks, criteria, and sources, laid out in streams (1-10 parallel threads, one column each). Start with research_get_topic. On a new topic, first call research_update_topic with streams (and kinds for the topic's own things, e.g. Carrier or Printer model, with fields like price), then add cards with research_add_cards, giving each root card a stream. Keep titles short (under 80 characters), put one or two sentences in gist, and the long form in body. Put findings under the question they answer, results under their task, and sources under the finding they back; link an option to the open question that blocks it (kind blocks). Keep each stream's answer current with research_update_topic. Writes return warnings: fix them when you can. Read open comments in research_get_topic and resolve them with research_resolve_comments after acting. Every write is a batch the user can undo.";

const cardTypes = RESEARCH_CARD_TYPES.filter((type) => type !== "summary") as [
  string,
  ...string[],
];
const cardShape = {
  type: z
    .enum(cardTypes)
    .optional()
    .describe(
      "Role: question | finding | option | task | criterion | source. Optional when kind is set.",
    ),
  kind: z
    .string()
    .optional()
    .describe("A kind declared on the topic, e.g. carrier. Sets the role."),
  title: z
    .string()
    .describe("Short label, under 80 characters. Shown everywhere."),
  gist: z
    .string()
    .optional()
    .describe(
      "One or two sentences (under 280 characters) shown on the board.",
    ),
  body: z
    .string()
    .optional()
    .describe("Long-form markdown (tables welcome), read in the card reader."),
  fields: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .describe('Values for the kind\'s fields, e.g. {"price": "$332"}.'),
  stream: z
    .string()
    .optional()
    .describe("Stream key. Set it on root cards; cards under them inherit it."),
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
    .describe("Your label so links in this call can point at it."),
  children: z
    .array(z.any())
    .optional()
    .describe(
      "Cards that came from this one, same shape: answers under a question, results under a task, sources under a finding.",
    ),
};

const ADD_CARDS_DESCRIPTION = `Add cards and links to a topic as one undoable batch; one card or only links is fine too.
Cards nest via "children" (came-from). Put new cards "under" an existing card id, usually the question or task you worked on, or set "stream" on new root cards.
Keep about 8 or fewer cards under any one card: split a long list into sub-questions or streams.
Links point at cards by your "ref", a positional path ("$0" = first card, "$0.1" = its second child), or an existing card id. kind: blocks (option ← open question/task), answers (finding → question elsewhere), supports (source → finding), relates_to (default).
The result lists warnings about this write (long titles, missing gists, cards in no stream, loose sources). Example:
{"topic":"printers","batchKey":"choose-1","summary":"Compared entry printers",
 "cards":[{"type":"question","stream":"choose","title":"Which printer fits my projects?","gist":"Small parts, some multicolor.","children":[
   {"type":"finding","title":"A1 Combo covers four-color prints","gist":"AMS lite feeds four spools.","body":"…","children":[{"type":"source","title":"A1 specs","url":"https://example.com/a1"}]}]},
  {"kind":"printer","stream":"choose","ref":"a1","title":"Bambu A1","gist":"Balanced starter.","fields":{"price":"$259"}}],
 "links":[{"from":"a1","to":"<open question id>","kind":"blocks"}]}`;

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
        "Create a research topic (one board). Returns its id, slug, and link. Next, declare its streams (and kinds) with research_update_topic.",
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
        'A topic as markdown with card ids. "summary" (default): the topic answer, kinds, topic-wide criteria, each stream with its answer, open questions and tasks, and options (fields and open blockers), open comments for you, what is worth fixing, and recent batches. "full": every card by stream as an outline, with gists, fields, and links.',
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
            ? formatTopicOutline(graph, topicAppUrl(ctx, graph.topic.slug))
            : formatTopicSummary(graph, topicAppUrl(ctx, graph.topic.slug)),
      };
    },
  );

  tools.read(
    "research_get_card",
    {
      title: "Get research card",
      description:
        "One card in full: stream, gist, fields, body, the chain it came from, its answers, results, sources, blockers, what it led to, and its comments.",
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
          .array(
            z.object({
              from: z.string(),
              to: z.string(),
              kind: z
                .enum(RESEARCH_LINK_KINDS)
                .optional()
                .describe("blocks | answers | supports | relates_to (default)"),
            }),
          )
          .optional()
          .describe("Links between cards (refs, $paths, or ids)."),
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
