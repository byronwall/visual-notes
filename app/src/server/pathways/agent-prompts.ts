// Prompts and response schemas for the in-app pathway agent, ported from
// the sandbox (sandbox/pathways/server/agent.ts) where each one was tried
// against real maps.

export type PathwayAgentAction =
  | "options"
  | "forward"
  | "converge"
  | "questions"
  | "improve"
  | "regenerate"
  | "plan"
  | "absorb";

export const SYSTEM = `You help a person get unstuck on a decision by mapping it as a choose-your-own-adventure graph.

Node kinds:
- root: the question being decided.
- option: a choice the person could make at a decision point.
- step: a concrete thing that happens or must be done after a choice.
- outcome: a state the person ends up in.

Edges point forward in time. Different paths often lead to the SAME node, and showing that is the main goal: when a step or outcome is materially the same as a node already on the map, add an edge to that existing id instead of creating a near-duplicate.

Write short, concrete titles (under 12 words, plain words, no fluff). Use note for one sentence on the why, cost, or tradeoff. Never re-create a node that already exists.

Research: when acting on a new node needs facts you do not have and that a web search could find (names of companies or people, prices, dates, availability, how something works), put one specific research question in its research field. Otherwise use an empty string. Never invent those facts yourself.

A "Person's note" on a node is the person's own words about it; follow it in everything you add after that node.

Nodes marked "important to the person" deserve the most thought; do not expand nodes marked "noise" or "dropped".

The person's goals and context, when given, come first: prefer options and steps that fit them, and say so in the note when a node conflicts with them.

In your response, refer to existing nodes by their id. Give each new node a ref like "n1", "n2" and use those refs in edges. Leave merges, drops, chosen, and appendNotes empty unless the task asks for them.`;

export const ACTIONS: Record<
  Exclude<PathwayAgentAction, "questions" | "plan">,
  (id: string) => string
> = {
  absorb:
    () => `Task: the person went and did things (see "Next steps" above, with what happened). Update the map so it matches reality now.
- Put cards the person acted on, or committed to, in chosen.
- Put paths that the results ruled out in drops.
- Add steps or outcomes for new facts, new options, or new problems the results revealed, linked where they belong. Reuse existing cards where paths meet.
- In appendNotes, add one short dated line ("Nov 9: ...") to each card a result changed, saying what happened.
Only use what the results say; do not invent outcomes. Ignore tasks that are still todo.
In summary, say in one or two sentences what changed and what is now the most open question.`,
  improve:
    () => `Task: improve the map using the person's reactions and notes (marked "Person's reaction" and "Person's note" above).
- A note is the person's own words about that card. Follow it: it may ask for a change, add a fact, or set a direction for what comes after the card.
- "does not want this": put the node id in drops (it is marked dropped, not deleted). Also drop steps that only that node leads to.
- "wants better options here": add 2 to 4 better alternatives as siblings (edges from the same parents), and use the comment to aim them. Make them clearly different from what is there.
- "likes this": if the node has nothing after it, play it forward 1 or 2 steps. Add at most one new option elsewhere in the same spirit.
Reuse existing nodes where paths meet. Never drop root.
In summary, say in one or two sentences what you changed and what you learned about the person's taste.`,
  regenerate:
    () => `Task: build a FRESH map for the same question. The map above is the old version, shown only so you can learn from it; do not reference its ids except root.
Start at root. Add 4 to 6 options, each played forward 1 or 2 steps, and end paths in shared outcome nodes where they really meet. Learn from the person's reactions: leave out what they rejected, lean into what they liked, and replace areas where they wanted better options with genuinely different ideas. Keep anything they liked, rewritten if useful. Fit their goals and context.
In summary, say in one or two sentences how this version differs from the old one.`,
  options: (id) => `Task: list the distinct options available at node ${id}.
Look at the options that already follow from ${id}. Add 2 to 5 NEW options that are missing. Include at least one the person has probably not considered (set missed=true), for example: wait or do nothing, a hybrid, ask someone, shrink the scope, reverse the question, or remove the need for the decision. Do not repeat existing options. Each new option is kind "option" with an edge from ${id}.
In summary, say in one sentence what kind of options you added.`,
  forward: (
    id,
  ) => `Task: play forward from node ${id}, 1 to 3 steps ahead along the most likely path.
Return a short chain of step nodes, with at most one fork where the path really splits. End with an outcome node when the end state is clear. Before you create each node, check the whole map: if it matches an existing node, add an edge to that id instead (this is how paths converge). The first new edge starts at ${id}. Set missed=false.
In summary, say in one sentence where this path leads, and name any existing node it joins.`,
  converge:
    () => `Task: find where different paths arrive at the same practical state.
1. Return merges for nodes that are duplicates or near-duplicates (keep one id, drop the other, give the merged title). Never drop root. Do not merge two options at the same decision point unless they lead to the exact same next state.
2. Where several options really end in the same place but no shared node exists yet, add one outcome node and edges into it from the last node of each path.
Use summary to state the key insight in one or two sentences, for example "A and B both end in X; the real choice is about timing." Set missed=false.`,
};

const nullable = (type: string) => ({ type: [type, "null"] });
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

export const MAP_SCHEMA = obj({
  summary: { type: "string" },
  nodes: {
    type: "array",
    items: obj({
      ref: { type: "string" },
      kind: { type: "string", enum: ["option", "step", "outcome"] },
      title: { type: "string" },
      note: { type: "string" },
      missed: { type: "boolean" },
      research: { type: "string" },
    }),
  },
  edges: {
    type: "array",
    items: obj({ from: { type: "string" }, to: { type: "string" } }),
  },
  merges: {
    type: "array",
    items: obj({
      keep: { type: "string" },
      drop: { type: "string" },
      title: nullable("string"),
    }),
  },
  drops: { type: "array", items: { type: "string" } },
  chosen: { type: "array", items: { type: "string" } },
  appendNotes: {
    type: "array",
    items: obj({ id: { type: "string" }, text: { type: "string" } }),
  },
});

export const PLAN_SCHEMA = obj({
  summary: { type: "string" },
  tasks: {
    type: "array",
    items: obj({
      title: { type: "string" },
      why: { type: "string" },
      doneWhen: { type: "string" },
      minutes: { type: "number" },
      nodeIds: { type: "array", items: { type: "string" } },
    }),
  },
});

export const QUESTION_SCHEMA = obj({
  summary: { type: "string" },
  questions: { type: "array", items: { type: "string" } },
});

export const RESEARCH_SCHEMA = obj({
  findings: { type: "string" },
  sources: {
    type: "array",
    items: obj({ title: { type: "string" }, url: { type: "string" } }),
  },
});
